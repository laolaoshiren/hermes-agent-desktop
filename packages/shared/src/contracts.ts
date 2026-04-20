import type { BrandConfig } from './branding.js'
import type { AppError } from './errors.js'

export type Channel = 'stable' | 'beta'
export type Locale = 'zh-CN' | 'en-US'
export type ThemeMode = 'light' | 'dark' | 'system'
export type RuntimeStatus = 'starting' | 'ready' | 'degraded' | 'failed'
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'openai-compatible'
  | 'openrouter'
  | 'ollama'
  | 'custom'
export type UpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'failed'
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'idle' | 'streaming' | 'completed' | 'cancelled' | 'failed'
export type AttachmentStatus = 'prepared' | 'committed' | 'failed'
export type AttachmentKind = 'file' | 'image'

export interface CapabilityFlags {
  supportsNativeShellTooling: boolean
  supportsPtyFull: boolean
  supportsSecureStorage: boolean
  supportsAutoUpdate: boolean
  supportsImagePaste: boolean
  supportsDragDropAttachments: boolean
}

export interface BootstrapState {
  app: {
    productName: string
    productVersion: string
    channel: Channel
    locale: Locale
    theme: ThemeMode
  }
  runtime: {
    runtimeVersion: string
    upstreamHermesVersion: string
    status: RuntimeStatus
  }
  onboarding: {
    isCompleted: boolean
    missingFields: string[]
  }
  provider: {
    configured: boolean
    providerType: ProviderType
    model: string | null
    baseUrl: string | null
  }
  capabilities: CapabilityFlags
  updates: {
    autoUpdateEnabled: boolean
    state: UpdateStage
  }
}

export interface ProviderSettings {
  providerType: ProviderType
  apiKey: string
  baseUrl: string
  model: string
  organization: string
  extraHeaders: Record<string, string>
}

export interface AppSettings {
  locale: Locale
  theme: ThemeMode
  autoUpdateEnabled: boolean
  updateChannel: Channel
  restoreLastSession: boolean
  diagnosticsPreference: 'redacted'
}

export interface ProviderTestResult {
  success: boolean
  latencyMs: number
  message: string
  resolvedModel: string | null
}

export interface SessionSummary {
  id: string
  title: string
  lastMessagePreview: string
  updatedAt: string
  messageCount: number
  pinned: boolean
}

export interface AttachmentItem {
  id: string
  name: string
  size: number
  mimeType: string
  kind: AttachmentKind
  status: AttachmentStatus
  localPath: string
  previewDataUrl: string | null
}

export interface MessageItem {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  createdAt: string
  status: MessageStatus
  attachmentIds: string[]
}

export interface ToolItem {
  id: string
  name: string
  description: string
  enabled: boolean
  risk: 'low' | 'medium' | 'high' | null
}

export interface SkillItem {
  id: string
  name: string
  description: string
  enabled: boolean
  risk: 'low' | 'medium' | 'high' | null
}

export interface UpdateState {
  state: UpdateStage
  autoUpdateEnabled: boolean
  channel: Channel
  currentVersion: string
  availableVersion: string | null
  downloadedVersion: string | null
  lastCheckedAt: string | null
  message: string
}

export interface HealthSnapshot {
  appStatus: 'ready' | 'degraded'
  adapterStatus: 'ready' | 'degraded'
  runtimeStatus: RuntimeStatus
  providerStatus: 'configured' | 'missing'
  lastCheckedAt: string | null
  capabilities: CapabilityFlags
  updateState: UpdateState
}

export interface DesktopEnvironment {
  adapterBaseUrl: string
  productName: string
  productVersion: string
  paths: {
    dataDir: string
    logsDir: string
  }
}

export interface AppPaths {
  configDir: string
  dataDir: string
  cacheDir: string
  logsDir: string
  updatesDir: string
  exportsDir: string
  attachmentsDir: string
  brand: BrandConfig
}

export interface SendMessageRequest {
  text: string
  attachmentIds?: string[]
  enabledTools?: string[]
  enabledSkills?: string[]
}

export type StreamEventType =
  | 'message.started'
  | 'message.delta'
  | 'message.completed'
  | 'tool.started'
  | 'tool.completed'
  | 'skill.started'
  | 'skill.completed'
  | 'warning'
  | 'error'

export interface StreamEvent<T = Record<string, unknown>> {
  type: StreamEventType
  payload: T
}

export interface DiagnosticsExportResult {
  path: string
}

export interface CapabilitiesPayload {
  tools: ToolItem[]
  skills: SkillItem[]
}

export interface AdapterErrorResponse {
  error: AppError
}
