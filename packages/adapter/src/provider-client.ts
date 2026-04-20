import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import {
  createAppError,
  type AppError,
  type AttachmentItem,
  type Locale,
  type MessageItem,
  type ProviderSettings,
  type ProviderTestResult
} from '@product/shared'

const DEFAULT_TIMEOUT_MS = 30_000
const ANTHROPIC_VERSION = '2023-06-01'
const INLINE_TEXT_LIMIT = 12_000

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'application/x-yaml',
  'application/yaml'
])

const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cs',
  '.css',
  '.csv',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.rb',
  '.rs',
  '.sql',
  '.svg',
  '.tex',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml'
])

type PreparedAttachment =
  | {
      kind: 'text'
      name: string
      mimeType: string
      size: number
      textContent: string
    }
  | {
      kind: 'image'
      name: string
      mimeType: string
      size: number
      dataUrl: string | null
    }
  | {
      kind: 'binary'
      name: string
      mimeType: string
      size: number
    }

interface PreparedMessage {
  role: 'system' | 'user' | 'assistant'
  text: string
  attachments: PreparedAttachment[]
}

interface PreparedConversation {
  messages: PreparedMessage[]
  warnings: string[]
}

export interface StreamProviderReplyOptions {
  providerSettings: ProviderSettings
  locale: Locale
  messages: MessageItem[]
  attachmentMap: Map<string, AttachmentItem>
  enabledTools: string[]
  enabledSkills: string[]
  signal: AbortSignal
  onDelta: (delta: string) => Promise<void> | void
}

export interface StreamProviderReplyResult {
  content: string
  warnings: string[]
}

function localize(locale: Locale, zh: string, en: string) {
  return locale === 'zh-CN' ? zh : en
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as Record<string, unknown>).code === 'string' &&
    typeof (value as Record<string, unknown>).message === 'string'
  )
}

function isLocalBaseUrl(baseUrl: string) {
  if (!baseUrl.trim()) {
    return false
  }

  try {
    const url = new URL(baseUrl)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
  } catch {
    return false
  }
}

export function requiresProviderBaseUrl(settings: ProviderSettings) {
  return settings.providerType === 'openai-compatible' || settings.providerType === 'custom'
}

export function requiresProviderApiKey(settings: ProviderSettings) {
  if (settings.providerType === 'ollama') {
    return false
  }

  if (
    (settings.providerType === 'openai-compatible' || settings.providerType === 'custom') &&
    isLocalBaseUrl(settings.baseUrl)
  ) {
    return false
  }

  return true
}

function normalizeBaseUrl(settings: ProviderSettings) {
  const baseUrl = settings.baseUrl.trim()

  if (settings.providerType === 'openai') {
    return baseUrl || 'https://api.openai.com/v1'
  }
  if (settings.providerType === 'openrouter') {
    return baseUrl || 'https://openrouter.ai/api/v1'
  }
  if (settings.providerType === 'anthropic') {
    return baseUrl || 'https://api.anthropic.com'
  }
  if (settings.providerType === 'ollama') {
    return baseUrl || 'http://127.0.0.1:11434'
  }
  return baseUrl
}

function toUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL(path.replace(/^\//, ''), normalizedBase).toString()
}

function createJsonHeaders(settings: ProviderSettings, contentType = true) {
  const headers = new Headers()

  if (contentType) {
    headers.set('Content-Type', 'application/json')
  }

  if (settings.organization.trim()) {
    headers.set('OpenAI-Organization', settings.organization.trim())
  }

  Object.entries(settings.extraHeaders).forEach(([key, value]) => {
    if (key.trim() && value.trim()) {
      headers.set(key, value)
    }
  })

  return headers
}

function applyProviderAuthHeaders(headers: Headers, settings: ProviderSettings) {
  if (settings.providerType === 'anthropic') {
    if (settings.apiKey.trim()) {
      headers.set('x-api-key', settings.apiKey.trim())
    }
    headers.set('anthropic-version', ANTHROPIC_VERSION)
    return
  }

  if (settings.apiKey.trim()) {
    headers.set('Authorization', `Bearer ${settings.apiKey.trim()}`)
  }

  if (settings.providerType === 'openrouter') {
    headers.set('X-Title', 'Hermes Agent Desktop')
  }
}

async function extractProviderError(response: Response) {
  const raw = await response.text()
  const fallback = `HTTP ${response.status} ${response.statusText}`.trim()

  try {
    const body = JSON.parse(raw) as Record<string, unknown>
    const message =
      (body.error as Record<string, unknown> | undefined)?.message ??
      body.message ??
      body.detail ??
      fallback
    return String(message)
  } catch {
    return raw.trim() || fallback
  }
}

function inferTextAttachment(attachment: AttachmentItem) {
  if (attachment.mimeType.startsWith('text/')) {
    return true
  }

  if (TEXT_MIME_TYPES.has(attachment.mimeType)) {
    return true
  }

  return TEXT_EXTENSIONS.has(extname(attachment.name).toLowerCase())
}

function truncateText(content: string) {
  if (content.length <= INLINE_TEXT_LIMIT) {
    return content
  }
  return `${content.slice(0, INLINE_TEXT_LIMIT)}\n\n[Truncated for prompt budget]`
}

async function fileToDataUrl(attachment: AttachmentItem) {
  try {
    const buffer = await readFile(attachment.localPath)
    const base64 = buffer.toString('base64')
    return `data:${attachment.mimeType};base64,${base64}`
  } catch {
    return null
  }
}

async function prepareAttachment(attachment: AttachmentItem): Promise<PreparedAttachment> {
  if (attachment.kind === 'image') {
    return {
      kind: 'image',
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      dataUrl: attachment.previewDataUrl ?? (await fileToDataUrl(attachment))
    }
  }

  if (inferTextAttachment(attachment)) {
    try {
      const raw = await readFile(attachment.localPath, 'utf8')
      return {
        kind: 'text',
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        textContent: truncateText(raw)
      }
    } catch {
      return {
        kind: 'binary',
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size
      }
    }
  }

  return {
    kind: 'binary',
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size
  }
}

function buildSystemPrompt(locale: Locale, enabledSkills: string[]) {
  const sections = [
    localize(
      locale,
      '你是 Hermes Agent Desktop 的桌面 AI 助手。默认使用简体中文回答，只有在用户明确要求英文或其他语言时才切换。',
      'You are the Hermes Agent Desktop desktop AI assistant. Default to English, but immediately switch to Chinese or another language when the user explicitly asks.'
    ),
    localize(
      locale,
      '当前是开源桌面版 v0.1 的直连模型模式。不要伪造你已经执行了本地命令、联网搜索、文件修改或其他工具动作；没有真实执行过的能力必须直接说明。',
      'You are running in the open-source desktop app v0.1 direct-model mode. Do not pretend that you executed shell commands, web searches, file edits, or other tools. If a capability is not truly available, say so plainly.'
    ),
    localize(
      locale,
      '如果用户附加了文本文件，输入里可能会直接内联文件内容；请把它们当作用户提供的材料来分析。回答要务实、准确、少空话。',
      'When the user attaches text files, their contents may be inlined into the prompt. Treat them as user-provided source material. Be practical, accurate, and concise.'
    )
  ]

  if (enabledSkills.includes('writing-polish')) {
    sections.push(
      localize(
        locale,
        '如果用户要润色、改写或写作帮助，优先优化结构、语气、清晰度和可执行性。',
        'When the user asks for writing help, prioritize structure, tone, clarity, and usefulness.'
      )
    )
  }

  if (enabledSkills.includes('meeting-summary')) {
    sections.push(
      localize(
        locale,
        '如果用户给出长文本或记录，优先整理为结论、待办、风险和下一步。',
        'When the user provides long notes or transcripts, organize them into conclusions, actions, risks, and next steps.'
      )
    )
  }

  if (enabledSkills.includes('code-review')) {
    sections.push(
      localize(
        locale,
        '如果用户请求代码评审，先给问题清单，再给假设和总结；重点放在 bug、风险、回归和缺失测试。',
        'When the user asks for a code review, lead with findings. Focus on bugs, risks, regressions, and missing tests before summary.'
      )
    )
  }

  return sections.join('\n\n')
}

function buildTextPayload(
  message: PreparedMessage,
  options: {
    canReadFiles: boolean
    canReadImages: boolean
    inlineImagesAsNotes?: boolean
  }
) {
  const sections: string[] = []
  const trimmedText = message.text.trim()

  if (trimmedText) {
    sections.push(trimmedText)
  }

  for (const attachment of message.attachments) {
    if (attachment.kind === 'text') {
      if (!options.canReadFiles) {
        sections.push(`[Attached text file not shared because file reading is disabled: ${attachment.name}]`)
        continue
      }

      sections.push(
        `<attached_text_file name="${attachment.name}" mime="${attachment.mimeType}">`,
        attachment.textContent,
        '</attached_text_file>'
      )
      continue
    }

    if (attachment.kind === 'image') {
      if (options.inlineImagesAsNotes || !options.canReadImages || !attachment.dataUrl) {
        sections.push(`[Attached image: ${attachment.name} (${attachment.mimeType})]`)
      }
      continue
    }

    sections.push(
      `[Attached file: ${attachment.name} (${attachment.mimeType || 'application/octet-stream'}, ${attachment.size} bytes)]`
    )
  }

  if (sections.length === 0) {
    return '[Empty message]'
  }

  return sections.join('\n\n')
}

async function prepareConversation(
  messages: MessageItem[],
  attachmentMap: Map<string, AttachmentItem>,
  enabledTools: string[]
): Promise<PreparedConversation> {
  const canReadFiles = enabledTools.includes('file-reader')
  const canReadImages = enabledTools.includes('image-reader')
  const warnings: string[] = []
  const preparedMessages: PreparedMessage[] = []

  for (const message of messages) {
    const attachments = await Promise.all(
      message.attachmentIds
        .map((attachmentId) => attachmentMap.get(attachmentId))
        .filter((attachment): attachment is AttachmentItem => Boolean(attachment))
        .map((attachment) => prepareAttachment(attachment))
    )

    preparedMessages.push({
      role: message.role,
      text: message.content,
      attachments
    })
  }

  if (!canReadFiles && preparedMessages.some((message) => message.attachments.some((item) => item.kind === 'text'))) {
    warnings.push(
      'File reading is disabled, so attached text files are sent as metadata only.'
    )
  }

  if (
    !canReadImages &&
    preparedMessages.some((message) => message.attachments.some((item) => item.kind === 'image'))
  ) {
    warnings.push(
      'Image reading is disabled, so attached images are sent as metadata only.'
    )
  }

  return {
    messages: preparedMessages,
    warnings
  }
}

function parseSseBlock(block: string) {
  const normalized = block.trim().replaceAll('\r', '')
  if (!normalized) {
    return null
  }

  const lines = normalized.split('\n')
  const event =
    lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s?/, '').trim() ?? null
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))
    .join('\n')

  if (!data) {
    return null
  }

  return { event, data }
}

async function consumeSse(
  response: Response,
  onEvent: (eventName: string | null, payload: string) => Promise<void>
) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw createAppError('NET_REQUEST_FAILED', 'Upstream stream body is missing.')
  }

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
      const parsed = parseSseBlock(block)
      if (parsed) {
        await onEvent(parsed.event, parsed.data)
      }
    }
  }

  const trailing = parseSseBlock(buffer)
  if (trailing) {
    await onEvent(trailing.event, trailing.data)
  }
}

function extractOpenAiDelta(payload: Record<string, unknown>) {
  const choices = payload.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return ''
  }

  const delta = (choices[0] as Record<string, unknown>).delta
  if (!delta || typeof delta !== 'object') {
    return ''
  }

  const content = (delta as Record<string, unknown>).content
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return ''
        }
        const text = (item as Record<string, unknown>).text
        return typeof text === 'string' ? text : ''
      })
      .join('')
  }

  return ''
}

async function streamOpenAiCompatibleReply(
  options: StreamProviderReplyOptions,
  preparedConversation: PreparedConversation
) {
  const baseUrl = normalizeBaseUrl(options.providerSettings)
  const headers = createJsonHeaders(options.providerSettings)
  applyProviderAuthHeaders(headers, options.providerSettings)

  const canReadFiles = options.enabledTools.includes('file-reader')
  const canReadImages = options.enabledTools.includes('image-reader')
  const supportsVision = options.providerSettings.providerType !== 'ollama'

  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(options.locale, options.enabledSkills)
    },
    ...preparedConversation.messages.map((message) => {
      if (message.role !== 'user') {
        return {
          role: message.role,
          content: buildTextPayload(message, {
            canReadFiles,
            canReadImages,
            inlineImagesAsNotes: true
          })
        }
      }

      const parts: Array<
        | {
            type: 'text'
            text: string
          }
        | {
            type: 'image_url'
            image_url: {
              url: string
            }
          }
      > = [
        {
          type: 'text',
          text: buildTextPayload(message, {
            canReadFiles,
            canReadImages,
            inlineImagesAsNotes: !supportsVision
          })
        }
      ]

      if (supportsVision && canReadImages) {
        for (const attachment of message.attachments) {
          if (attachment.kind === 'image' && attachment.dataUrl) {
            parts.push({
              type: 'image_url',
              image_url: {
                url: attachment.dataUrl
              }
            })
          }
        }
      }

      return {
        role: 'user',
        content: parts.length === 1 && parts[0]?.type === 'text' ? parts[0].text : parts
      }
    })
  ]

  const response = await fetch(toUrl(baseUrl, 'chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.providerSettings.model,
      stream: true,
      messages
    }),
    signal: options.signal
  })

  if (!response.ok) {
    throw createAppError('NET_REQUEST_FAILED', await extractProviderError(response))
  }

  let output = ''

  await consumeSse(response, async (_event, payload) => {
    if (payload === '[DONE]') {
      return
    }

    const parsed = JSON.parse(payload) as Record<string, unknown>
    const delta = extractOpenAiDelta(parsed)
    if (!delta) {
      return
    }

    output += delta
    await options.onDelta(delta)
  })

  return output
}

function toAnthropicMessages(
  preparedConversation: PreparedConversation,
  canReadFiles: boolean,
  canReadImages: boolean
) {
  return preparedConversation.messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      const content: Array<Record<string, unknown>> = [
        {
          type: 'text',
          text: buildTextPayload(message, {
            canReadFiles,
            canReadImages,
            inlineImagesAsNotes: false
          })
        }
      ]

      if (message.role === 'user' && canReadImages) {
        for (const attachment of message.attachments) {
          if (attachment.kind !== 'image' || !attachment.dataUrl) {
            continue
          }

          const commaIndex = attachment.dataUrl.indexOf(',')
          if (commaIndex === -1) {
            continue
          }

          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: attachment.mimeType,
              data: attachment.dataUrl.slice(commaIndex + 1)
            }
          })
        }
      }

      return {
        role: message.role,
        content
      }
    })
}

async function streamAnthropicReply(
  options: StreamProviderReplyOptions,
  preparedConversation: PreparedConversation
) {
  const baseUrl = normalizeBaseUrl(options.providerSettings)
  const headers = createJsonHeaders(options.providerSettings)
  applyProviderAuthHeaders(headers, options.providerSettings)

  const response = await fetch(toUrl(baseUrl, 'v1/messages'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.providerSettings.model,
      system: buildSystemPrompt(options.locale, options.enabledSkills),
      max_tokens: 1024,
      stream: true,
      messages: toAnthropicMessages(
        preparedConversation,
        options.enabledTools.includes('file-reader'),
        options.enabledTools.includes('image-reader')
      )
    }),
    signal: options.signal
  })

  if (!response.ok) {
    throw createAppError('NET_REQUEST_FAILED', await extractProviderError(response))
  }

  let output = ''

  await consumeSse(response, async (_event, payload) => {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    const type = parsed.type
    if (type !== 'content_block_delta') {
      return
    }

    const delta = parsed.delta
    if (!delta || typeof delta !== 'object') {
      return
    }

    const deltaType = (delta as Record<string, unknown>).type
    const text = (delta as Record<string, unknown>).text
    if (deltaType !== 'text_delta' || typeof text !== 'string') {
      return
    }

    output += text
    await options.onDelta(text)
  })

  return output
}

async function streamOllamaReply(
  options: StreamProviderReplyOptions,
  preparedConversation: PreparedConversation
) {
  const baseUrl = normalizeBaseUrl(options.providerSettings)
  const headers = createJsonHeaders(options.providerSettings)
  applyProviderAuthHeaders(headers, options.providerSettings)

  const response = await fetch(toUrl(baseUrl, 'api/chat'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.providerSettings.model,
      stream: true,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(options.locale, options.enabledSkills)
        },
        ...preparedConversation.messages.map((message) => ({
          role: message.role,
          content: buildTextPayload(message, {
            canReadFiles: options.enabledTools.includes('file-reader'),
            canReadImages: false,
            inlineImagesAsNotes: true
          })
        }))
      ]
    }),
    signal: options.signal
  })

  if (!response.ok) {
    throw createAppError('NET_REQUEST_FAILED', await extractProviderError(response))
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw createAppError('NET_REQUEST_FAILED', 'Ollama stream body is missing.')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let output = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const normalized = line.trim()
      if (!normalized) {
        continue
      }

      const parsed = JSON.parse(normalized) as Record<string, unknown>
      const message = parsed.message
      if (!message || typeof message !== 'object') {
        continue
      }

      const content = (message as Record<string, unknown>).content
      if (typeof content !== 'string' || !content) {
        continue
      }

      output += content
      await options.onDelta(content)
    }
  }

  if (buffer.trim()) {
    const parsed = JSON.parse(buffer.trim()) as Record<string, unknown>
    const message = parsed.message
    const content =
      message && typeof message === 'object'
        ? (message as Record<string, unknown>).content
        : undefined
    if (typeof content === 'string' && content) {
      output += content
      await options.onDelta(content)
    }
  }

  return output
}

export async function streamProviderReply(
  options: StreamProviderReplyOptions
): Promise<StreamProviderReplyResult> {
  try {
    const preparedConversation = await prepareConversation(
      options.messages,
      options.attachmentMap,
      options.enabledTools
    )

    const content =
      options.providerSettings.providerType === 'anthropic'
        ? await streamAnthropicReply(options, preparedConversation)
        : options.providerSettings.providerType === 'ollama'
          ? await streamOllamaReply(options, preparedConversation)
          : await streamOpenAiCompatibleReply(options, preparedConversation)

    return {
      content,
      warnings: preparedConversation.warnings
    }
  } catch (error) {
    if (isAppError(error)) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    if (error instanceof Error) {
      throw createAppError('NET_REQUEST_FAILED', error.message)
    }

    throw createAppError('NET_REQUEST_FAILED')
  }
}

function createTimeoutSignal() {
  return AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
}

export async function testProviderConnection(
  settings: ProviderSettings,
  locale: Locale
): Promise<ProviderTestResult> {
  const startedAt = Date.now()
  const baseUrl = normalizeBaseUrl(settings)

  const buildResult = (message: string): ProviderTestResult => ({
    success: true,
    latencyMs: Math.max(50, Date.now() - startedAt),
    message,
    resolvedModel: settings.model || null
  })

  if (settings.providerType === 'ollama') {
    const response = await fetch(toUrl(baseUrl, 'api/tags'), {
      headers: (() => {
        const headers = createJsonHeaders(settings, false)
        applyProviderAuthHeaders(headers, settings)
        return headers
      })(),
      signal: createTimeoutSignal()
    })

    if (!response.ok) {
      throw createAppError('NET_REQUEST_FAILED', await extractProviderError(response))
    }

    return buildResult(
      localize(
        locale,
        `已连接到 Ollama，本次将使用模型 ${settings.model}。`,
        `Connected to Ollama. The app will use model ${settings.model}.`
      )
    )
  }

  if (settings.providerType === 'anthropic') {
    const headers = createJsonHeaders(settings, false)
    applyProviderAuthHeaders(headers, settings)

    const response = await fetch(toUrl(baseUrl, 'v1/models'), {
      headers,
      signal: createTimeoutSignal()
    })

    if (!response.ok) {
      throw createAppError('NET_REQUEST_FAILED', await extractProviderError(response))
    }

    return buildResult(
      localize(
        locale,
        `已连接到 Anthropic，本次将使用模型 ${settings.model}。`,
        `Connected to Anthropic. The app will use model ${settings.model}.`
      )
    )
  }

  const headers = createJsonHeaders(settings, false)
  applyProviderAuthHeaders(headers, settings)

  const response = await fetch(toUrl(baseUrl, 'models'), {
    headers,
    signal: createTimeoutSignal()
  })

  if (!response.ok) {
    throw createAppError('NET_REQUEST_FAILED', await extractProviderError(response))
  }

  return buildResult(
    localize(
      locale,
      `已连接到 ${settings.providerType}，本次将使用模型 ${settings.model}。`,
      `Connected to ${settings.providerType}. The app will use model ${settings.model}.`
    )
  )
}
