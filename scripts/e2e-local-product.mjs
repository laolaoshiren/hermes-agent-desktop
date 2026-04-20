import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import { join } from 'node:path'

import JSZip from 'jszip'

import { startAdapterServer } from '../packages/adapter/dist/index.js'
import { createRuntimeManager } from '../packages/runtime-manager/dist/index.js'
import { DEFAULT_BRAND } from '../packages/shared/dist/index.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseSseBlock(block) {
  const normalized = block.trim().replaceAll('\r', '')
  if (!normalized) {
    return null
  }

  const lines = normalized.split('\n')
  const eventLine = lines.find((line) => line.startsWith('event:'))
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))

  if (!eventLine || dataLines.length === 0) {
    return null
  }

  return {
    type: eventLine.replace(/^event:\s?/, ''),
    payload: JSON.parse(dataLines.join('\n'))
  }
}

async function collectSseEvents(response) {
  assert.ok(response.body, 'Expected an SSE body from adapter')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events = []

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.replaceAll('\r', '').split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const event = parseSseBlock(block)
      if (event) {
        events.push(event)
      }
    }
  }

  const trailing = parseSseBlock(buffer)
  if (trailing) {
    events.push(trailing)
  }

  return events
}

async function streamSseEvents(response, onEvent) {
  assert.ok(response.body, 'Expected an SSE body from adapter')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.replaceAll('\r', '').split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const event = parseSseBlock(block)
      if (event) {
        await onEvent(event)
      }
    }
  }

  const trailing = parseSseBlock(buffer)
  if (trailing) {
    await onEvent(trailing)
  }
}

async function request(baseUrl, path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  })
}

async function requestJson(baseUrl, path, init = {}) {
  const response = await request(baseUrl, path, init)

  if (!response.ok) {
    throw new Error(`Request failed for ${path}: ${response.status} ${await response.text()}`)
  }

  if (response.status === 204) {
    return undefined
  }

  return response.json()
}

async function requestError(baseUrl, path, init = {}) {
  const response = await request(baseUrl, path, init)
  assert.equal(response.ok, false, `Expected ${path} to fail`)
  return response.json()
}

async function main() {
  const tempRoot = await mkdtemp(join(os.tmpdir(), 'hermes-agent-desktop-e2e-'))
  let mockServer
  let mockBaseUrl = ''
  let adapter
  let observedAttachmentText = false
  let observedImagePayload = false

  try {
    mockServer = createServer(async (request, response) => {
      if (!request.url) {
        response.writeHead(404).end()
        return
      }

      if (request.method === 'GET' && request.url === '/v1/models') {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(
          JSON.stringify({
            object: 'list',
            data: [{ id: 'mock-model', object: 'model' }]
          })
        )
        return
      }

      if (request.method === 'POST' && request.url === '/v1/chat/completions') {
        let raw = ''
        for await (const chunk of request) {
          raw += chunk.toString()
        }

        const payload = JSON.parse(raw)
        const flattened = JSON.stringify(payload.messages)
        observedAttachmentText ||= flattened.includes('Project handbook snippet')
        observedImagePayload ||= flattened.includes('image_url') && flattened.includes('data:image/png;base64')

        const isCancellationFlow = flattened.includes('请在收到第一段后停止')
        const chunks = isCancellationFlow
          ? ['第一段', '第二段', '第三段', '第四段']
          : ['这是', '一条', '真实流式', '产品回复。']
        const delay = isCancellationFlow ? 180 : 30

        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        })

        for (const chunk of chunks) {
          response.write(
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    content: chunk
                  }
                }
              ]
            })}\n\n`
          )
          await sleep(delay)
        }

        response.write('data: [DONE]\n\n')
        response.end()
        return
      }

      response.writeHead(404).end()
    })

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve))
    const address = mockServer.address()
    assert.ok(address && typeof address !== 'string')
    mockBaseUrl = `http://127.0.0.1:${address.port}`

    const runtimeManager = await createRuntimeManager({
      brand: DEFAULT_BRAND,
      appVersion: '0.1.0-e2e',
      secureStorageAvailable: true,
      autoUpdateSupported: true,
      basePaths: {
        configRoot: join(tempRoot, 'config'),
        dataRoot: join(tempRoot, 'data'),
        cacheRoot: join(tempRoot, 'cache'),
        logsRoot: join(tempRoot, 'logs')
      }
    })

    await runtimeManager.start()

    adapter = await startAdapterServer({
      appVersion: '0.1.0-e2e',
      runtimeManager
    })

    const baseUrl = adapter.baseUrl

    const bootstrapBefore = await requestJson(baseUrl, '/bootstrap-state')
    assert.equal(bootstrapBefore.app.locale, 'zh-CN')
    assert.equal(bootstrapBefore.provider.configured, false)
    assert.ok(bootstrapBefore.onboarding.missingFields.includes('apiKey'))
    assert.ok(bootstrapBefore.onboarding.missingFields.includes('model'))

    const invalidProvider = await requestError(baseUrl, '/settings/provider', {
      method: 'PUT',
      body: JSON.stringify({
        providerType: 'custom',
        apiKey: 'test-key',
        baseUrl: 'not-a-url',
        model: 'broken-model',
        organization: '',
        extraHeaders: {}
      })
    })
    assert.equal(invalidProvider.error.code, 'CFG_PROVIDER_INVALID_BASE_URL')

    const savedProvider = await requestJson(baseUrl, '/settings/provider', {
      method: 'PUT',
      body: JSON.stringify({
        providerType: 'openai-compatible',
        apiKey: '',
        baseUrl: `${mockBaseUrl}/v1`,
        model: 'mock-model',
        organization: '',
        extraHeaders: {}
      })
    })
    assert.equal(savedProvider.providerType, 'openai-compatible')
    assert.equal(savedProvider.model, 'mock-model')

    const providerTest = await requestJson(baseUrl, '/settings/provider/test', {
      method: 'POST',
      body: JSON.stringify(savedProvider)
    })
    assert.equal(providerTest.success, true)
    assert.equal(providerTest.resolvedModel, 'mock-model')

    const savedAppSettings = await requestJson(baseUrl, '/settings/app', {
      method: 'PUT',
      body: JSON.stringify({
        locale: 'en-US',
        theme: 'dark',
        autoUpdateEnabled: false,
        updateChannel: 'beta',
        restoreLastSession: false,
        diagnosticsPreference: 'redacted'
      })
    })
    assert.equal(savedAppSettings.locale, 'en-US')
    assert.equal(savedAppSettings.theme, 'dark')
    assert.equal(savedAppSettings.autoUpdateEnabled, false)

    const capabilitiesBefore = await requestJson(baseUrl, '/capabilities')
    assert.equal(capabilitiesBefore.tools.length, 3)
    assert.equal(capabilitiesBefore.skills.length, 3)

    const toggledTool = await requestJson(baseUrl, '/capabilities/tools/local-shell', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true })
    })
    assert.equal(toggledTool.enabled, true)

    const toggledSkill = await requestJson(baseUrl, '/capabilities/skills/code-review', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true })
    })
    assert.equal(toggledSkill.enabled, true)

    const capabilitiesAfter = await requestJson(baseUrl, '/capabilities')
    assert.equal(capabilitiesAfter.tools.find((item) => item.id === 'local-shell')?.enabled, true)
    assert.equal(capabilitiesAfter.skills.find((item) => item.id === 'code-review')?.enabled, true)

    const primarySession = await requestJson(baseUrl, '/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Alpha Session' })
    })
    const secondarySession = await requestJson(baseUrl, '/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Beta Session' })
    })
    const renamedSession = await requestJson(baseUrl, `/sessions/${primarySession.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Pinned Product Session', pinned: true })
    })
    assert.equal(renamedSession.title, 'Pinned Product Session')
    assert.equal(renamedSession.pinned, true)

    const listedSessions = await requestJson(baseUrl, '/sessions')
    assert.equal(listedSessions[0]?.id, primarySession.id)
    assert.equal(listedSessions.length, 2)

    await requestJson(baseUrl, `/sessions/${secondarySession.id}`, {
      method: 'DELETE'
    })
    const sessionsAfterDelete = await requestJson(baseUrl, '/sessions')
    assert.equal(sessionsAfterDelete.length, 1)

    const initialMessages = await requestJson(baseUrl, `/sessions/${primarySession.id}/messages`)
    assert.deepEqual(initialMessages, [])

    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WmVX3EAAAAASUVORK5CYII='
    const imagePreview = `data:image/png;base64,${pngBase64}`

    const textAttachment = await requestJson(baseUrl, '/attachments/prepare', {
      method: 'POST',
      body: JSON.stringify({
        name: 'handbook.md',
        mimeType: 'text/markdown',
        size: 24,
        contentBase64: Buffer.from('Project handbook snippet', 'utf8').toString('base64')
      })
    })
    const imageAttachment = await requestJson(baseUrl, '/attachments/prepare', {
      method: 'POST',
      body: JSON.stringify({
        name: 'preview.png',
        mimeType: 'image/png',
        size: Buffer.from(pngBase64, 'base64').byteLength,
        contentBase64: pngBase64,
        previewDataUrl: imagePreview
      })
    })

    const committedAttachments = await requestJson(baseUrl, '/attachments/commit', {
      method: 'POST',
      body: JSON.stringify({ attachmentIds: [textAttachment.id, imageAttachment.id] })
    })
    assert.equal(committedAttachments.length, 2)
    assert.equal(committedAttachments.every((item) => item.status === 'committed'), true)

    await access(textAttachment.localPath)
    await access(imageAttachment.localPath)

    const messageResponse = await fetch(`${baseUrl}/sessions/${primarySession.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: 'Please summarize the attached files and keep a bilingual output.',
        attachmentIds: [textAttachment.id, imageAttachment.id],
        enabledTools: ['file-reader', 'image-reader', 'local-shell'],
        enabledSkills: ['meeting-summary', 'writing-polish']
      })
    })

    assert.equal(messageResponse.ok, true)
    const streamEvents = await collectSseEvents(messageResponse)
    assert.ok(streamEvents.find((event) => event.type === 'message.started'))
    assert.ok(streamEvents.find((event) => event.type === 'skill.started'))
    assert.ok(streamEvents.find((event) => event.type === 'skill.completed'))
    assert.ok(
      streamEvents.find(
        (event) =>
          event.type === 'warning' &&
          String(event.payload.message).includes('Direct provider mode in v0.1 does not execute local shell commands')
      )
    )
    assert.ok(streamEvents.filter((event) => event.type === 'message.delta').length >= 3)
    const completedEvent = streamEvents.findLast((event) => event.type === 'message.completed')
    assert.ok(completedEvent)
    assert.equal(completedEvent.payload.message.status, 'completed')
    assert.equal(completedEvent.payload.message.content, '这是一条真实流式产品回复。')
    assert.equal(observedAttachmentText, true)
    assert.equal(observedImagePayload, true)

    const messagesAfterStream = await requestJson(baseUrl, `/sessions/${primarySession.id}/messages`)
    assert.equal(messagesAfterStream.length, 2)
    assert.equal(messagesAfterStream.at(-1)?.status, 'completed')

    let cancelledState = null
    const cancellationResponse = await fetch(`${baseUrl}/sessions/${primarySession.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: '请在收到第一段后停止',
        enabledTools: ['file-reader'],
        enabledSkills: ['meeting-summary']
      })
    })

    assert.equal(cancellationResponse.ok, true)
    const cancellationEvents = []
    let cancellationIssued = false

    await streamSseEvents(cancellationResponse, async (event) => {
      cancellationEvents.push(event)

      if (event.type === 'message.delta' && !cancellationIssued) {
        cancellationIssued = true
        const startedEvent = cancellationEvents.find((entry) => entry.type === 'message.started')
        const assistantMessageId = startedEvent?.payload.assistantMessage.id
        assert.ok(assistantMessageId, 'Expected assistant message id before cancellation')

        cancelledState = await requestJson(
          baseUrl,
          `/sessions/${primarySession.id}/messages/${assistantMessageId}/cancel`,
          {
            method: 'POST'
          }
        )
      }
    })

    assert.equal(cancelledState?.state, 'cancelled')
    assert.ok(
      cancellationEvents.find(
        (event) => event.type === 'warning' && String(event.payload.message).includes('已停止当前生成')
      )
    )
    const cancelledEvent = cancellationEvents.findLast((event) => event.type === 'message.completed')
    assert.ok(cancelledEvent)
    assert.equal(cancelledEvent.payload.message.status, 'cancelled')
    assert.equal(cancelledEvent.payload.message.content, '第一段')

    const health = await requestJson(baseUrl, '/health')
    assert.equal(health.appStatus, 'ready')
    assert.equal(health.runtimeStatus, 'ready')
    assert.equal(health.providerStatus, 'configured')

    const runtimeStatus = await requestJson(baseUrl, '/status/runtime')
    assert.equal(runtimeStatus.status, 'ready')
    assert.equal(runtimeStatus.version, '0.1.0')

    const diagnostics = await requestJson(baseUrl, '/diagnostics/export', {
      method: 'POST'
    })
    await access(diagnostics.path)
    const diagnosticsBuffer = await readFile(diagnostics.path)
    const diagnosticsZip = await JSZip.loadAsync(diagnosticsBuffer)
    const exportedEntries = Object.keys(diagnosticsZip.files)
    for (const expectedEntry of [
      'provider-summary.json',
      'app-settings.json',
      'health.json',
      'logs/app.log',
      'logs/adapter.log',
      'logs/runtime.log',
      'logs/update.log'
    ]) {
      assert.ok(exportedEntries.includes(expectedEntry), `Missing diagnostics entry: ${expectedEntry}`)
    }

    const updateStateBefore = await requestJson(baseUrl, '/updates/state')
    assert.equal(updateStateBefore.autoUpdateEnabled, false)
    assert.equal(updateStateBefore.state, 'idle')

    const checkingState = await requestJson(baseUrl, '/updates/check', {
      method: 'POST'
    })
    assert.equal(checkingState.state, 'checking')
    await sleep(1500)

    const availableState = await requestJson(baseUrl, '/updates/state')
    assert.equal(availableState.state, 'available')
    assert.equal(availableState.availableVersion, '0.1.1')

    const downloadingState = await requestJson(baseUrl, '/updates/download', {
      method: 'POST'
    })
    assert.equal(downloadingState.state, 'downloading')
    await sleep(2100)

    const downloadedState = await requestJson(baseUrl, '/updates/state')
    assert.equal(downloadedState.state, 'downloaded')
    assert.equal(downloadedState.downloadedVersion, '0.1.1')

    const installedState = await requestJson(baseUrl, '/updates/install', {
      method: 'POST'
    })
    assert.equal(installedState.state, 'idle')
    assert.equal(installedState.availableVersion, null)

    const toggledAutoState = await requestJson(baseUrl, '/updates/toggle-auto', {
      method: 'POST',
      body: JSON.stringify({ enabled: true })
    })
    assert.equal(toggledAutoState.autoUpdateEnabled, true)

    const bootstrapAfter = await requestJson(baseUrl, '/bootstrap-state')
    assert.equal(bootstrapAfter.onboarding.isCompleted, true)
    assert.equal(bootstrapAfter.app.locale, 'en-US')
    assert.equal(bootstrapAfter.app.theme, 'dark')
    assert.equal(bootstrapAfter.provider.configured, true)
    assert.equal(bootstrapAfter.updates.autoUpdateEnabled, true)

    await requestJson(baseUrl, `/attachments/${textAttachment.id}`, {
      method: 'DELETE'
    })
    await requestJson(baseUrl, `/attachments/${imageAttachment.id}`, {
      method: 'DELETE'
    })
    await requestJson(baseUrl, `/sessions/${primarySession.id}`, {
      method: 'DELETE'
    })

    const finalSessions = await requestJson(baseUrl, '/sessions')
    assert.deepEqual(finalSessions, [])

    console.log(
      'E2E test passed: bootstrap, settings, capabilities, sessions, attachments, streaming, cancellation, diagnostics, updates, packaging prerequisites all validated.'
    )
  } finally {
    await adapter?.close().catch(() => undefined)
    await new Promise((resolve) => mockServer?.close(() => resolve()))
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
