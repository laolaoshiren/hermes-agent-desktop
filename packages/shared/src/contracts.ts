import type { BrandConfig } from './branding.js'

export type Locale = 'zh-CN' | 'en-US'
export type ThemeMode = 'light' | 'dark' | 'system'
export type RuntimeStatus = 'stopped' | 'starting' | 'ready' | 'degraded' | 'failed'
export type ServiceStatus = 'stopped' | 'starting' | 'ready' | 'failed'
export type PythonBootstrapState = 'ready' | 'missing-deps'
export type DesktopPage = 'chat' | 'dashboard' | 'bridge'
export type HermesMessageRole = 'user' | 'assistant' | 'system'
export type HermesCompanionCommand =
  | 'chat-tui'
  | 'sessions'
  | 'model'
  | 'tools'
  | 'auth'
  | 'profile'
  | 'gateway-setup'
export type HermesRunEventType =
  | 'message.delta'
  | 'tool.started'
  | 'tool.completed'
  | 'reasoning.available'
  | 'run.completed'
  | 'run.failed'

export interface AppPaths {
  configDir: string
  dataDir: string
  cacheDir: string
  logsDir: string
  updatesDir: string
  exportsDir: string
  attachmentsDir: string
  hermesHome: string
  brand: BrandConfig
}

export interface DesktopSettings {
  locale: Locale
  theme: ThemeMode
  launchOnStartup: boolean
  openDashboardOnLaunch: boolean
}

export interface RuntimeServiceSnapshot {
  status: ServiceStatus
  port: number | null
  url: string | null
  pid: number | null
  startedAt: string | null
  lastError: string | null
  lastExitCode: number | null
}

export interface RuntimeDependencyStatus {
  fastapi: boolean
  uvicorn: boolean
  aiohttp: boolean
  yaml: boolean
  pydantic: boolean
}

export interface PythonRuntimeSnapshot {
  executable: string
  version: string | null
  sitePackagesDir: string
  bootstrapState: PythonBootstrapState
  dependencies: RuntimeDependencyStatus
}

export interface HermesRuntimeSnapshot {
  overallStatus: RuntimeStatus
  appVersion: string
  upstreamHermesVersion: string
  lastError: string | null
  paths: {
    hermesHome: string
    dataDir: string
    logsDir: string
    configDir: string
  }
  python: PythonRuntimeSnapshot
  dashboard: RuntimeServiceSnapshot
  api: RuntimeServiceSnapshot & {
    apiKey: string | null
  }
}

export interface DesktopEnvironment {
  productName: string
  productVersion: string
  locale: Locale
  defaultPage: DesktopPage
  settings: DesktopSettings
  runtime: HermesRuntimeSnapshot
}

export interface RuntimeCommandResult {
  snapshot: HermesRuntimeSnapshot
}

export interface CompanionCommandResult {
  command: HermesCompanionCommand
}

export interface RuntimeLogTail {
  dashboard: string[]
  gateway: string[]
}

export interface HermesConversationMessage {
  role: HermesMessageRole
  content: string
}

export interface HermesRunRequest {
  input: string
  conversationHistory: HermesConversationMessage[]
  instructions?: string | null
  sessionId?: string | null
}

export interface HermesRunStartResponse {
  run_id: string
  status: 'started'
}

export interface HermesRunUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface HermesRunEvent {
  event: HermesRunEventType
  run_id: string
  timestamp: number
  delta?: string
  tool?: string
  preview?: string | null
  duration?: number
  error?: string | boolean
  text?: string
  output?: string
  usage?: HermesRunUsage
}
