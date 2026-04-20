import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import { join } from 'node:path'

import { startAdapterServer } from '../packages/adapter/dist/index.js'
import { createRuntimeManager } from '../packages/runtime-manager/dist/index.js'
import { DEFAULT_BRAND } from '../packages/shared/dist/index.js'

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

async function readSse(response) {
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

async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  })

  if (!response.ok) {
    throw new Error(`Request failed for ${path}: ${response.status} ${await response.text()}`)
  }

  if (response.status === 204) {
    return undefined
  }

  return response.json()
}

async function main() {
  const tempRoot = await mkdtemp(join(os.tmpdir(), 'aurora-desk-smoke-'))
  let mockServer
  let mockBaseUrl = ''
  let adapter
  let observedAttachmentText = false

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
        const flattenedContent = JSON.stringify(payload.messages)
        observedAttachmentText = flattenedContent.includes('Project handbook snippet')

        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        })

        const chunks = ['这是', '一条', '真实流式', 'Mock 回复。']
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
          await new Promise((resolve) => setTimeout(resolve, 15))
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
      appVersion: '0.1.0-smoke',
      secureStorageAvailable: false,
      autoUpdateSupported: false,
      basePaths: {
        configRoot: join(tempRoot, 'config'),
        dataRoot: join(tempRoot, 'data'),
        cacheRoot: join(tempRoot, 'cache'),
        logsRoot: join(tempRoot, 'logs')
      }
    })

    await runtimeManager.start()

    adapter = await startAdapterServer({
      appVersion: '0.1.0-smoke',
      runtimeManager
    })

    const baseUrl = adapter.baseUrl

    await requestJson(baseUrl, '/settings/provider', {
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

    const providerTest = await requestJson(baseUrl, '/settings/provider/test', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'openai-compatible',
        apiKey: '',
        baseUrl: `${mockBaseUrl}/v1`,
        model: 'mock-model',
        organization: '',
        extraHeaders: {}
      })
    })

    assert.equal(providerTest.success, true)

    const session = await requestJson(baseUrl, '/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Smoke Session' })
    })

    const attachment = await requestJson(baseUrl, '/attachments/prepare', {
      method: 'POST',
      body: JSON.stringify({
        name: 'handbook.md',
        mimeType: 'text/markdown',
        size: 24,
        contentBase64: Buffer.from('Project handbook snippet', 'utf8').toString('base64')
      })
    })

    await requestJson(baseUrl, '/attachments/commit', {
      method: 'POST',
      body: JSON.stringify({ attachmentIds: [attachment.id] })
    })

    const streamResponse = await fetch(`${baseUrl}/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: '请确认流式回复是否正常。',
        attachmentIds: [attachment.id],
        enabledTools: ['file-reader'],
        enabledSkills: ['meeting-summary']
      })
    })

    assert.equal(streamResponse.ok, true)
    const events = await readSse(streamResponse)
    const deltas = events.filter((event) => event.type === 'message.delta')
    const completed = events.findLast((event) => event.type === 'message.completed')

    assert.ok(deltas.length >= 2, 'Expected multiple streaming deltas')
    assert.ok(completed, 'Expected a final completion event')
    assert.equal(
      completed.payload.message.content,
      '这是一条真实流式Mock 回复。',
      'Unexpected final assistant output'
    )
    assert.equal(observedAttachmentText, true, 'Expected text attachment content to reach provider payload')

    console.log('Smoke test passed: adapter streamed a real provider response end-to-end.')
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
