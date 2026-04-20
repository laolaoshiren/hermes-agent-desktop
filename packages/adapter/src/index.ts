import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import cors from 'cors'
import express from 'express'
import JSZip from 'jszip'

import type { RuntimeManager } from '@product/runtime-manager'
import {
  createAppError,
  type AppError,
  type AppSettings,
  type BootstrapState,
  type DiagnosticsExportResult,
  type HealthSnapshot,
  type MessageItem,
  type ProviderSettings,
  type SendMessageRequest,
  type StreamEvent,
  type UpdateState
} from '@product/shared'

import {
  requiresProviderApiKey,
  requiresProviderBaseUrl,
  streamProviderReply,
  testProviderConnection
} from './provider-client.js'
import { DesktopStateStore } from './store.js'

interface AdapterOptions {
  appVersion: string
  runtimeManager: RuntimeManager
}

interface UpdateService {
  state: UpdateState
  check(): Promise<UpdateState>
  download(): Promise<UpdateState>
  install(): Promise<UpdateState>
  toggleAuto(enabled: boolean): Promise<UpdateState>
}

function validateProviderSettings(settings: ProviderSettings): AppError | null {
  if (!settings.providerType) {
    return createAppError('CFG_PROVIDER_MISSING_TYPE')
  }
  if (requiresProviderBaseUrl(settings) && !settings.baseUrl.trim()) {
    return createAppError(
      'CFG_PROVIDER_INVALID_BASE_URL',
      'Base URL is required for this provider type.'
    )
  }
  if (!settings.apiKey.trim() && requiresProviderApiKey(settings)) {
    return createAppError('CFG_PROVIDER_MISSING_API_KEY')
  }
  if (!settings.model.trim()) {
    return createAppError('CFG_PROVIDER_MISSING_MODEL')
  }
  if (settings.baseUrl.trim()) {
    try {
      new URL(settings.baseUrl)
    } catch {
      return createAppError('CFG_PROVIDER_INVALID_BASE_URL')
    }
  }
  return null
}

function collectMissingProviderFields(settings: ProviderSettings) {
  const missingFields: string[] = []

  if (!settings.providerType) {
    missingFields.push('providerType')
  }
  if (requiresProviderBaseUrl(settings) && !settings.baseUrl.trim()) {
    missingFields.push('baseUrl')
  }
  if (!settings.apiKey.trim() && requiresProviderApiKey(settings)) {
    missingFields.push('apiKey')
  }
  if (!settings.model.trim()) {
    missingFields.push('model')
  }

  return missingFields
}

function createUpdateService(
  appVersion: string,
  initialState: UpdateState,
  onLog: (message: string) => Promise<void>
): UpdateService {
  let state = initialState

  return {
    get state() {
      return state
    },
    async check() {
      state = {
        ...state,
        state: 'checking',
        message: '正在检查新版'
      }
      await onLog('开始检查更新。')
      setTimeout(async () => {
        state = {
          ...state,
          state: 'available',
          availableVersion: '0.1.1',
          lastCheckedAt: new Date().toISOString(),
          message: '检测到可下载的新版本。'
        }
        await onLog('发现可用更新 0.1.1。')
      }, 1200)
      return state
    },
    async download() {
      if (state.state !== 'available') {
        return state
      }
      state = {
        ...state,
        state: 'downloading',
        message: '正在后台下载更新'
      }
      await onLog('开始下载更新。')
      setTimeout(async () => {
        state = {
          ...state,
          state: 'downloaded',
          downloadedVersion: state.availableVersion ?? appVersion,
          message: '新版本已准备好，重启后即可完成更新。'
        }
        await onLog('更新已下载完成。')
      }, 1800)
      return state
    },
    async install() {
      state = {
        ...state,
        state: 'idle',
        availableVersion: null,
        downloadedVersion: null,
        message: '当前已是最新状态。'
      }
      await onLog('用户执行了更新安装。')
      return state
    },
    async toggleAuto(enabled: boolean) {
      state = {
        ...state,
        autoUpdateEnabled: enabled
      }
      await onLog(`自动更新已切换为 ${enabled}`)
      return state
    }
  }
}

function toBootstrapState(
  appVersion: string,
  runtimeManager: RuntimeManager,
  providerSettings: ProviderSettings,
  appSettings: AppSettings,
  updateState: UpdateState
): BootstrapState {
  const missingFields = collectMissingProviderFields(providerSettings)

  return {
    app: {
      productName: runtimeManager.paths.brand.productName,
      productVersion: appVersion,
      channel: appSettings.updateChannel,
      locale: appSettings.locale,
      theme: appSettings.theme
    },
    runtime: {
      runtimeVersion: runtimeManager.runtimeVersion,
      upstreamHermesVersion: runtimeManager.upstreamHermesVersion,
      status: runtimeManager.getStatus()
    },
    onboarding: {
      isCompleted: missingFields.length === 0,
      missingFields
    },
    provider: {
      configured: missingFields.length === 0,
      providerType: providerSettings.providerType,
      model: providerSettings.model || null,
      baseUrl: providerSettings.baseUrl || null
    },
    capabilities: runtimeManager.capabilities,
    updates: {
      autoUpdateEnabled: updateState.autoUpdateEnabled,
      state: updateState.state
    }
  }
}

export async function startAdapterServer(options: AdapterOptions) {
  const store = new DesktopStateStore(options.runtimeManager.paths)
  await store.initialize()

  const appSettings = await store.getAppSettings()
  const updateService = createUpdateService(
    options.appVersion,
    {
      state: 'idle',
      autoUpdateEnabled: appSettings.autoUpdateEnabled,
      channel: appSettings.updateChannel,
      currentVersion: options.appVersion,
      availableVersion: null,
      downloadedVersion: null,
      lastCheckedAt: null,
      message: '当前已是最新状态。'
    },
    (message) => store.appendUpdateLog(message)
  )

  const activeStreams = new Map<string, AbortController>()

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '20mb' }))

  app.get('/bootstrap-state', async (_request, response) => {
    const [providerSettings, latestAppSettings] = await Promise.all([
      store.getProviderSettings(),
      store.getAppSettings()
    ])
    response.json(
      toBootstrapState(
        options.appVersion,
        options.runtimeManager,
        providerSettings,
        latestAppSettings,
        updateService.state
      )
    )
  })

  app.get('/settings/provider', async (_request, response) => {
    response.json(await store.getProviderSettings())
  })

  app.put('/settings/provider', async (request, response) => {
    const providerSettings = request.body as ProviderSettings
    const validationError = validateProviderSettings(providerSettings)
    if (validationError) {
      response.status(400).json({ error: validationError })
      return
    }

    response.json(await store.saveProviderSettings(providerSettings))
  })

  app.post('/settings/provider/test', async (request, response) => {
    const providerSettings = request.body as ProviderSettings
    const validationError = validateProviderSettings(providerSettings)
    if (validationError) {
      response.status(400).json({ error: validationError })
      return
    }

    try {
      const { locale } = await store.getAppSettings()
      response.json(await testProviderConnection(providerSettings, locale))
    } catch (error) {
      response.status(502).json({
        error:
          typeof error === 'object' && error !== null && 'code' in error
            ? error
            : createAppError(
                'NET_REQUEST_FAILED',
                error instanceof Error ? error.message : undefined
              )
      })
    }
  })

  app.get('/settings/app', async (_request, response) => {
    response.json(await store.getAppSettings())
  })

  app.put('/settings/app', async (request, response) => {
    const settings = request.body as AppSettings
    const saved = await store.saveAppSettings(settings)
    await updateService.toggleAuto(saved.autoUpdateEnabled)
    response.json(saved)
  })

  app.get('/capabilities', async (_request, response) => {
    response.json(await store.getCapabilities())
  })

  app.patch('/capabilities/:kind/:id', async (request, response) => {
    const kind = request.params.kind === 'skills' ? 'skills' : 'tools'
    const item = await store.toggleCapability(kind, request.params.id, Boolean(request.body.enabled))
    if (!item) {
      response.status(404).json({ error: createAppError('APP_REQUEST_INVALID') })
      return
    }
    response.json(item)
  })

  app.get('/sessions', async (_request, response) => {
    response.json(await store.listSessions())
  })

  app.post('/sessions', async (request, response) => {
    response.json(await store.createSession(request.body.title))
  })

  app.patch('/sessions/:id', async (request, response) => {
    const session = await store.updateSession(request.params.id, request.body)
    if (!session) {
      response.status(404).json({ error: createAppError('RT_SESSION_NOT_FOUND') })
      return
    }
    response.json(session)
  })

  app.delete('/sessions/:id', async (request, response) => {
    await store.deleteSession(request.params.id)
    response.status(204).end()
  })

  app.get('/sessions/:id/messages', async (request, response) => {
    const messages = await store.getMessages(request.params.id)
    if (!messages) {
      response.status(404).json({ error: createAppError('RT_SESSION_NOT_FOUND') })
      return
    }
    response.json(messages)
  })

  app.post('/sessions/:id/messages', async (request, response) => {
    const providerSettings = await store.getProviderSettings()
    const validationError = validateProviderSettings(providerSettings)
    if (validationError) {
      response.status(400).json({ error: validationError })
      return
    }

    const body = request.body as SendMessageRequest
    if (!body.text.trim()) {
      response.status(400).json({ error: createAppError('APP_REQUEST_INVALID') })
      return
    }

    const existingMessages = await store.getMessages(request.params.id)
    if (!existingMessages) {
      response.status(404).json({ error: createAppError('RT_SESSION_NOT_FOUND') })
      return
    }

    const attachments = await store.getAttachmentsByIds(body.attachmentIds ?? [])
    const userMessage: MessageItem = {
      id: randomUUID(),
      sessionId: request.params.id,
      role: 'user',
      content: body.text.trim(),
      createdAt: new Date().toISOString(),
      status: 'completed',
      attachmentIds: attachments.map((entry) => entry.id)
    }
    const assistantMessage: MessageItem = {
      id: randomUUID(),
      sessionId: request.params.id,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
      attachmentIds: []
    }

    const appendedUser = await store.appendMessage(request.params.id, userMessage)
    const appendedAssistant = await store.appendMessage(request.params.id, assistantMessage)
    if (!appendedUser || !appendedAssistant) {
      response.status(404).json({ error: createAppError('RT_SESSION_NOT_FOUND') })
      return
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    const sendEvent = (event: StreamEvent) => {
      response.write(`event: ${event.type}\n`)
      response.write(`data: ${JSON.stringify(event.payload)}\n\n`)
    }

    sendEvent({
      type: 'message.started',
      payload: {
        userMessage: appendedUser,
        assistantMessage: appendedAssistant
      }
    })

    const controller = new AbortController()
    activeStreams.set(assistantMessage.id, controller)

    const enabledTools = body.enabledTools ?? []
    const enabledSkills = body.enabledSkills ?? []
    const conversationMessages = [...existingMessages, userMessage]
    const conversationAttachmentIds = [...new Set(conversationMessages.flatMap((item) => item.attachmentIds))]
    const conversationAttachments = await store.getAttachmentsByIds(conversationAttachmentIds)
    const attachmentMap = new Map(conversationAttachments.map((item) => [item.id, item]))
    const { locale } = await store.getAppSettings()

    if (enabledTools.includes('local-shell')) {
      sendEvent({
        type: 'warning',
        payload: {
          message:
            locale === 'zh-CN'
              ? 'v0.1 直连模型模式不会执行本地命令，local-shell 开关目前只会保留为后续 Hermes 集成入口。'
              : 'Direct provider mode in v0.1 does not execute local shell commands. The local-shell toggle is reserved for a later Hermes runtime integration.'
        }
      })
    }

    if (enabledSkills.length > 0) {
      sendEvent({
        type: 'skill.started',
        payload: { skillIds: enabledSkills }
      })
    }

    let output = ''
    let lastPersistAt = 0

    try {
      await store.appendRuntimeLog(
        `Starting provider request for session ${request.params.id} via ${providerSettings.providerType}:${providerSettings.model}`
      )

      const result = await streamProviderReply({
        providerSettings,
        locale,
        messages: conversationMessages,
        attachmentMap,
        enabledTools,
        enabledSkills,
        signal: controller.signal,
        onDelta: async (delta) => {
          output += delta

          sendEvent({
            type: 'message.delta',
            payload: {
              messageId: assistantMessage.id,
              delta
            }
          })

          const now = Date.now()
          if (now - lastPersistAt >= 200) {
            lastPersistAt = now
            await store.updateMessage(request.params.id, assistantMessage.id, {
              content: output,
              status: 'streaming'
            })
          }
        }
      })

      for (const warning of result.warnings) {
        sendEvent({
          type: 'warning',
          payload: {
            message:
              locale === 'zh-CN'
                ? warning
                    .replace('File reading is disabled, so attached text files are sent as metadata only.', '文件理解已关闭，因此文本附件只会以元数据形式进入模型上下文。')
                    .replace('Image reading is disabled, so attached images are sent as metadata only.', '图片理解已关闭，因此图片附件只会以元数据形式进入模型上下文。')
                : warning
          }
        })
      }

      const completedMessage = await store.updateMessage(request.params.id, assistantMessage.id, {
        content: output || result.content,
        status: 'completed'
      })
      const finalCompletedMessage = completedMessage ?? {
        ...assistantMessage,
        content: output || result.content,
        status: 'completed' as const
      }

      if (enabledSkills.length > 0) {
        sendEvent({
          type: 'skill.completed',
          payload: { skillIds: enabledSkills }
        })
      }

      sendEvent({
        type: 'message.completed',
        payload: {
          message: finalCompletedMessage
        }
      })

      await store.appendRuntimeLog(
        `Completed provider request for session ${request.params.id} with ${output.length} characters returned.`
      )
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        const cancelledMessage = await store.updateMessage(request.params.id, assistantMessage.id, {
          content: output,
          status: 'cancelled'
        })
        const finalCancelledMessage = cancelledMessage ?? {
          ...assistantMessage,
          content: output,
          status: 'cancelled' as const
        }

        sendEvent({
          type: 'warning',
          payload: { message: '已停止当前生成。', messageId: assistantMessage.id }
        })
        sendEvent({
          type: 'message.completed',
          payload: {
            message: finalCancelledMessage
          }
        })

        await store.appendRuntimeLog(`Cancelled provider request for session ${request.params.id}.`)
      } else {
        const errorMessage =
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
            ? (error as { message: string }).message
            : locale === 'zh-CN'
              ? '模型请求失败，请稍后重试。'
              : 'The model request failed. Please try again.'

        const failedMessage = await store.updateMessage(request.params.id, assistantMessage.id, {
          content: output,
          status: 'failed'
        })
        const finalFailedMessage = failedMessage ?? {
          ...assistantMessage,
          content: output,
          status: 'failed' as const
        }

        sendEvent({
          type: 'error',
          payload: {
            message: errorMessage,
            messageId: assistantMessage.id
          }
        })
        sendEvent({
          type: 'message.completed',
          payload: {
            message: finalFailedMessage
          }
        })

        await store.appendRuntimeLog(
          `Provider request failed for session ${request.params.id}: ${errorMessage}`
        )
      }
    } finally {
      activeStreams.delete(assistantMessage.id)
      response.end()
    }
  })

  app.post('/sessions/:id/messages/:messageId/cancel', async (request, response) => {
    const controller = activeStreams.get(request.params.messageId)
    if (!controller) {
      response.json({ success: true, state: 'already_completed' })
      return
    }

    controller.abort()
    response.json({ success: true, state: 'cancelled' })
  })

  app.post('/attachments/prepare', async (request, response) => {
    const payload = request.body as {
      name: string
      mimeType: string
      size: number
      contentBase64: string
      previewDataUrl?: string | null
    }

    if (!payload.name || !payload.mimeType || !payload.contentBase64) {
      response.status(400).json({ error: createAppError('ATT_INVALID_PAYLOAD') })
      return
    }
    if (payload.size > 15 * 1024 * 1024) {
      response.status(400).json({ error: createAppError('ATT_FILE_TOO_LARGE') })
      return
    }

    const attachment = await store.createAttachment({
      name: payload.name,
      mimeType: payload.mimeType,
      size: payload.size,
      base64: payload.contentBase64,
      previewDataUrl: payload.previewDataUrl ?? null
    })
    response.json(attachment)
  })

  app.post('/attachments/commit', async (request, response) => {
    response.json(await store.commitAttachments(request.body.attachmentIds ?? []))
  })

  app.delete('/attachments/:id', async (request, response) => {
    await store.deleteAttachment(request.params.id)
    response.status(204).end()
  })

  app.get('/health', async (_request, response) => {
    const providerSettings = await store.getProviderSettings()
    const health: HealthSnapshot = {
      appStatus: 'ready',
      adapterStatus: 'ready',
      runtimeStatus: options.runtimeManager.getStatus(),
      providerStatus:
        validateProviderSettings(providerSettings) === null ? 'configured' : 'missing',
      lastCheckedAt: updateService.state.lastCheckedAt,
      capabilities: options.runtimeManager.capabilities,
      updateState: updateService.state
    }
    response.json(health)
  })

  app.get('/status/runtime', async (_request, response) => {
    response.json({
      version: options.runtimeManager.runtimeVersion,
      upstreamVersion: options.runtimeManager.upstreamHermesVersion,
      status: options.runtimeManager.getStatus()
    })
  })

  app.post('/diagnostics/export', async (_request, response) => {
    const [providerSettings, appSettingsSnapshot, healthSnapshot, logs] = await Promise.all([
      store.getProviderSettings(),
      store.getAppSettings(),
      (async () => {
        const payload: HealthSnapshot = {
          appStatus: 'ready',
          adapterStatus: 'ready',
          runtimeStatus: options.runtimeManager.getStatus(),
          providerStatus:
            validateProviderSettings(await store.getProviderSettings()) === null
              ? 'configured'
              : 'missing',
          lastCheckedAt: updateService.state.lastCheckedAt,
          capabilities: options.runtimeManager.capabilities,
          updateState: updateService.state
        }
        return payload
      })(),
      store.getLogs()
    ])

    const zip = new JSZip()
    zip.file(
      'provider-summary.json',
      JSON.stringify(
        {
          providerType: providerSettings.providerType,
          model: providerSettings.model,
          baseUrl: providerSettings.baseUrl ? '已配置' : '未配置',
          organization: providerSettings.organization ? '已配置' : '未配置',
          extraHeaders: Object.keys(providerSettings.extraHeaders)
        },
        null,
        2
      )
    )
    zip.file('app-settings.json', JSON.stringify(appSettingsSnapshot, null, 2))
    zip.file('health.json', JSON.stringify(healthSnapshot, null, 2))
    zip.file('logs/app.log', logs.appLog)
    zip.file('logs/adapter.log', logs.adapterLog)
    zip.file('logs/runtime.log', logs.runtimeLog)
    zip.file('logs/update.log', logs.updateLog)

    const outputPath = join(
      options.runtimeManager.paths.exportsDir,
      `diagnostics-${Date.now()}.zip`
    )
    const content = await zip.generateAsync({ type: 'nodebuffer' })
    await writeFile(outputPath, content)

    const result: DiagnosticsExportResult = { path: outputPath }
    response.json(result)
  })

  app.get('/updates/state', async (_request, response) => {
    response.json(updateService.state)
  })

  app.post('/updates/check', async (_request, response) => {
    response.json(await updateService.check())
  })

  app.post('/updates/download', async (_request, response) => {
    response.json(await updateService.download())
  })

  app.post('/updates/install', async (_request, response) => {
    response.json(await updateService.install())
  })

  app.post('/updates/toggle-auto', async (request, response) => {
    const enabled = Boolean(request.body.enabled)
    const appSettingsSnapshot = await store.getAppSettings()
    await store.saveAppSettings({
      ...appSettingsSnapshot,
      autoUpdateEnabled: enabled
    })
    response.json(await updateService.toggleAuto(enabled))
  })

  const server = createServer(app)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw createAppError('RT_START_FAILED')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      }),
    store
  }
}
