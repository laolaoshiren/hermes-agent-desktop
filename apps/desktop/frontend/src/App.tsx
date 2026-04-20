import { useEffect, useMemo, useState } from 'react'

import type {
  DesktopEnvironment,
  HermesCompanionCommand,
  HermesConversationMessage,
  HermesRunEvent,
  HermesRunStartResponse,
  HermesRuntimeSnapshot,
  Locale,
  RuntimeLogTail
} from '@product/shared'

type Page = 'workspace' | 'quick-run' | 'commands' | 'diagnostics'

type UiMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  status: 'idle' | 'streaming' | 'completed' | 'failed'
}

type ActivityItem = {
  id: string
  kind: 'tool' | 'reasoning' | 'status'
  title: string
  detail: string
}

type CommandCard = {
  command: HermesCompanionCommand
  title: string
  description: string
  shell: string
}

type CommandGroup = {
  id: string
  title: string
  description: string
  cards: CommandCard[]
}

type LogChannel = 'dashboard' | 'gateway'
type ActionState = 'start' | 'restart' | 'stop' | null

const STORAGE_KEYS = {
  page: 'hermes.desktop.page',
  locale: 'hermes.desktop.locale'
} as const

const COPY = {
  'zh-CN': {
    loading: '正在连接 Hermes Agent Desktop…',
    productTag: '面向真实 Hermes Agent 的桌面控制台。主入口是原生 Dashboard，聊天、命令和诊断都连接同一套运行时。',
    localeLabel: '语言',
    localeHint: '中文优先，可切换英文',
    pages: {
      workspace: '工作台',
      quickRun: '快速执行',
      commands: '命令中心',
      diagnostics: '运行状态'
    },
    pageCopy: {
      workspaceTitle: '原生 Hermes Dashboard',
      workspaceBody: '这里直接承载 Hermes 自带 Web UI，不再用桌面壳伪造聊天工作区。',
      workspaceWaiting: 'Dashboard 还没有就绪。先启动运行时，桌面端会接入真实 Hermes Dashboard。',
      quickRunTitle: '真实 API 快速执行',
      quickRunBody: '这个页面通过 Hermes Gateway 的 `/v1/runs` 与真实运行时通信，适合快速下达任务。',
      quickRunWaiting: 'Gateway 还没有就绪，暂时无法发送真实 Hermes 任务。',
      commandsTitle: '真实 Hermes 命令入口',
      commandsBody: '这些按钮会直接打开 Hermes 原生命令，而不是桌面端自造设置页。',
      diagnosticsTitle: '运行状态与恢复',
      diagnosticsBody: '把运行时、依赖、路径和日志集中在这里，避免主界面被诊断信息淹没。'
    },
    runtime: {
      section: '运行时',
      start: '启动',
      restart: '重启',
      stop: '停止',
      runtimeReady: '运行中',
      runtimeStarting: '启动中',
      runtimeStopped: '已停止',
      runtimeFailed: '失败',
      runtimeDegraded: '降级',
      dashboard: 'Dashboard',
      api: 'Gateway API',
      python: 'Python',
      dependencies: '依赖',
      ready: '就绪',
      offline: '离线',
      missingDeps: '依赖不完整',
      logs: '日志',
      tools: '工具入口',
      paths: '路径',
      sharedState: '共享状态',
      sharedStateBody: '桌面壳、Dashboard、Gateway、CLI/TUI 使用同一个 HERMES_HOME。'
    },
    quickRun: {
      session: '会话',
      sessionId: 'Hermes Session ID',
      newSession: '新会话',
      composerPlaceholder: '向真实 Hermes Agent 发送任务，例如：扫描当前项目、分析日志、修改配置、整理需求。',
      send: '发送到 Hermes',
      sending: '执行中…',
      activity: '实时事件',
      messages: '消息流',
      emptyMessages: '这里展示 Hermes Gateway 返回的真实消息流。',
      emptyActivity: '工具、推理和运行状态会显示在这里。',
      runReady: 'Gateway 已连接',
      runWaiting: 'Gateway 未就绪',
      user: '你',
      assistant: 'Hermes',
      system: '系统',
      ctrlEnter: 'Ctrl/Cmd + Enter 发送'
    },
    commands: {
      launch: '打开命令',
      launching: '打开中…'
    },
    diagnostics: {
      serviceState: '服务状态',
      lastError: '最近错误',
      noLogs: '暂无日志',
      dashboardLog: 'Dashboard 日志',
      gatewayLog: 'Gateway 日志',
      openHome: '打开 Hermes Home',
      openLogs: '打开日志目录',
      openNotes: '开源说明',
      dependencyReady: '依赖完整',
      dependencyMissing: '依赖缺失'
    },
    notices: {
      runtimeUnavailable: '运行时尚未就绪。',
      apiUnavailable: 'Gateway 尚未就绪，无法执行真实 Hermes 任务。'
    },
    eventLabels: {
      toolStarted: '工具启动',
      toolCompleted: '工具完成',
      reasoning: '推理片段',
      completed: '执行完成',
      failed: '执行失败'
    },
    misc: {
      unknown: '未知',
      none: '无',
      open: '打开',
      modelAndAuth: '模型与鉴权',
      sessionsAndTerminal: '会话与终端',
      toolsAndGateway: '工具与网关'
    }
  },
  'en-US': {
    loading: 'Connecting to Hermes Agent Desktop…',
    productTag:
      'Desktop control surface for the real Hermes Agent. The native dashboard stays primary, while chat, commands, and diagnostics attach to the same runtime.',
    localeLabel: 'Language',
    localeHint: 'Chinese-first, English optional',
    pages: {
      workspace: 'Workspace',
      quickRun: 'Quick Run',
      commands: 'Commands',
      diagnostics: 'Diagnostics'
    },
    pageCopy: {
      workspaceTitle: 'Native Hermes Dashboard',
      workspaceBody: 'This embeds the web UI shipped by Hermes instead of faking a desktop-only workspace.',
      workspaceWaiting:
        'The dashboard is not ready yet. Start the runtime first and the desktop shell will attach to the real Hermes dashboard.',
      quickRunTitle: 'Real API Quick Run',
      quickRunBody:
        'This view talks to the Hermes Gateway `/v1/runs` endpoint for direct tasks against the real runtime.',
      quickRunWaiting: 'The gateway is not ready yet, so real Hermes runs are unavailable.',
      commandsTitle: 'Real Hermes Command Entry Points',
      commandsBody:
        'These buttons launch native Hermes commands instead of inventing desktop-only settings screens.',
      diagnosticsTitle: 'Runtime Status and Recovery',
      diagnosticsBody:
        'Keep runtime state, dependencies, paths, and logs here so diagnostics do not take over the main workspace.'
    },
    runtime: {
      section: 'Runtime',
      start: 'Start',
      restart: 'Restart',
      stop: 'Stop',
      runtimeReady: 'Ready',
      runtimeStarting: 'Starting',
      runtimeStopped: 'Stopped',
      runtimeFailed: 'Failed',
      runtimeDegraded: 'Degraded',
      dashboard: 'Dashboard',
      api: 'Gateway API',
      python: 'Python',
      dependencies: 'Dependencies',
      ready: 'Ready',
      offline: 'Offline',
      missingDeps: 'Missing deps',
      logs: 'Logs',
      tools: 'Tool entrypoints',
      paths: 'Paths',
      sharedState: 'Shared state',
      sharedStateBody: 'The desktop shell, dashboard, gateway, and CLI/TUI all share one HERMES_HOME.'
    },
    quickRun: {
      session: 'Session',
      sessionId: 'Hermes Session ID',
      newSession: 'New Session',
      composerPlaceholder:
        'Send a real Hermes task, for example: inspect this repo, analyze logs, change config, summarize requirements.',
      send: 'Send to Hermes',
      sending: 'Running…',
      activity: 'Live events',
      messages: 'Message stream',
      emptyMessages: 'Real Hermes Gateway messages will appear here.',
      emptyActivity: 'Tool, reasoning, and run events will appear here.',
      runReady: 'Gateway ready',
      runWaiting: 'Gateway offline',
      user: 'You',
      assistant: 'Hermes',
      system: 'System',
      ctrlEnter: 'Ctrl/Cmd + Enter to send'
    },
    commands: {
      launch: 'Open command',
      launching: 'Opening…'
    },
    diagnostics: {
      serviceState: 'Service state',
      lastError: 'Latest error',
      noLogs: 'No logs yet',
      dashboardLog: 'Dashboard log',
      gatewayLog: 'Gateway log',
      openHome: 'Open Hermes Home',
      openLogs: 'Open logs folder',
      openNotes: 'Open source notes',
      dependencyReady: 'Dependencies ready',
      dependencyMissing: 'Dependencies missing'
    },
    notices: {
      runtimeUnavailable: 'The runtime is not ready yet.',
      apiUnavailable: 'The gateway is not ready, so real Hermes tasks cannot run.'
    },
    eventLabels: {
      toolStarted: 'Tool started',
      toolCompleted: 'Tool completed',
      reasoning: 'Reasoning',
      completed: 'Run completed',
      failed: 'Run failed'
    },
    misc: {
      unknown: 'Unknown',
      none: 'None',
      open: 'Open',
      modelAndAuth: 'Model and auth',
      sessionsAndTerminal: 'Sessions and terminal',
      toolsAndGateway: 'Tools and gateway'
    }
  }
} as const

function trimLogLines(lines: string[]) {
  return lines.slice(-160)
}

function readStoredPage(): Page {
  const stored = window.localStorage.getItem(STORAGE_KEYS.page)
  if (
    stored === 'workspace' ||
    stored === 'quick-run' ||
    stored === 'commands' ||
    stored === 'diagnostics'
  ) {
    return stored
  }
  return 'workspace'
}

function readStoredLocale(): Locale | null {
  const stored = window.localStorage.getItem(STORAGE_KEYS.locale)
  if (stored === 'zh-CN' || stored === 'en-US') {
    return stored
  }
  return null
}

function runtimeStatusLabel(locale: Locale, status: HermesRuntimeSnapshot['overallStatus']) {
  const copy = COPY[locale].runtime
  if (status === 'ready') {
    return copy.runtimeReady
  }
  if (status === 'starting') {
    return copy.runtimeStarting
  }
  if (status === 'failed') {
    return copy.runtimeFailed
  }
  if (status === 'degraded') {
    return copy.runtimeDegraded
  }
  return copy.runtimeStopped
}

function serviceStatusLabel(locale: Locale, status: 'ready' | 'starting' | 'failed' | 'stopped') {
  const copy = COPY[locale].runtime
  if (status === 'ready') {
    return copy.ready
  }
  if (status === 'starting') {
    return copy.runtimeStarting
  }
  if (status === 'failed') {
    return copy.runtimeFailed
  }
  return copy.offline
}

function statusTone(status: HermesRuntimeSnapshot['overallStatus'] | 'ready' | 'starting' | 'failed' | 'stopped') {
  if (status === 'ready') {
    return 'ready'
  }
  if (status === 'starting') {
    return 'starting'
  }
  if (status === 'failed') {
    return 'failed'
  }
  if (status === 'degraded') {
    return 'degraded'
  }
  return 'stopped'
}

function dependencySummary(runtime: HermesRuntimeSnapshot) {
  const dependencies = Object.values(runtime.python.dependencies)
  const readyCount = dependencies.filter(Boolean).length
  return {
    readyCount,
    totalCount: dependencies.length,
    allReady: dependencies.every(Boolean)
  }
}

function formatValue(value: string | null | number | null, fallback: string) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  return String(value)
}

function formatTimestamp(locale: Locale, value: string | null) {
  if (!value) {
    return COPY[locale].misc.none
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(value))
  } catch {
    return value
  }
}

async function readSseStream(
  url: string,
  headers: Record<string, string>,
  onEvent: (event: HermesRunEvent) => void
) {
  const response = await fetch(url, { headers })
  if (!response.ok || !response.body) {
    throw new Error(await response.text())
  }

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
      const dataLines = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''))

      if (dataLines.length === 0) {
        continue
      }

      onEvent(JSON.parse(dataLines.join('\n')) as HermesRunEvent)
    }
  }

  const trailingDataLines = buffer
    .replaceAll('\r', '')
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))

  if (trailingDataLines.length > 0) {
    onEvent(JSON.parse(trailingDataLines.join('\n')) as HermesRunEvent)
  }
}

function getCommandGroups(locale: Locale): CommandGroup[] {
  if (locale === 'zh-CN') {
    return [
      {
        id: 'model-auth',
        title: '模型、鉴权与 Profile',
        description: '这些入口直接打开原生 Hermes 命令，用来改模型、Provider、API Key 和 Profile。',
        cards: [
          {
            command: 'model',
            title: '模型与 Provider',
            description: '打开真实 `hermes model` 流程，切换模型与 Provider。',
            shell: 'hermes model'
          },
          {
            command: 'auth',
            title: '鉴权池',
            description: '打开真实 `hermes auth` 管理 API Key、OAuth 和凭据。',
            shell: 'hermes auth'
          },
          {
            command: 'profile',
            title: 'Profiles',
            description: '打开真实 `hermes profile`，切换不同身份与配置。',
            shell: 'hermes profile'
          }
        ]
      },
      {
        id: 'sessions-terminal',
        title: '会话与终端',
        description: '桌面端不替代 TUI，这些入口直接拉起 Hermes 原生终端能力。',
        cards: [
          {
            command: 'chat-tui',
            title: '原生 TUI',
            description: '打开真实 `hermes chat --tui` 聊天界面。',
            shell: 'hermes chat --tui'
          },
          {
            command: 'sessions',
            title: 'Sessions',
            description: '打开真实 `hermes sessions list` 查看会话。',
            shell: 'hermes sessions list'
          }
        ]
      },
      {
        id: 'tools-gateway',
        title: '工具与网关',
        description: '继续使用 Hermes 本身的工具和 Gateway 配置，不在桌面端复制一套假设置。',
        cards: [
          {
            command: 'tools',
            title: 'Tools / Toolsets',
            description: '打开真实 `hermes tools` 配置工具与 toolsets。',
            shell: 'hermes tools'
          },
          {
            command: 'gateway-setup',
            title: 'Gateway Setup',
            description: '打开真实 `hermes gateway setup` 配置网关接入。',
            shell: 'hermes gateway setup'
          }
        ]
      }
    ]
  }

  return [
    {
      id: 'model-auth',
      title: 'Model, Auth, and Profiles',
      description: 'Open native Hermes commands for model changes, provider switching, credentials, and profiles.',
      cards: [
        {
          command: 'model',
          title: 'Model and Provider',
          description: 'Launch the real `hermes model` flow.',
          shell: 'hermes model'
        },
        {
          command: 'auth',
          title: 'Auth Pool',
          description: 'Launch the real `hermes auth` command.',
          shell: 'hermes auth'
        },
        {
          command: 'profile',
          title: 'Profiles',
          description: 'Launch the real `hermes profile` flow.',
          shell: 'hermes profile'
        }
      ]
    },
    {
      id: 'sessions-terminal',
      title: 'Sessions and Terminal',
      description: 'The desktop shell does not replace the TUI. These actions open native Hermes terminal flows.',
      cards: [
        {
          command: 'chat-tui',
          title: 'Native TUI',
          description: 'Open the real `hermes chat --tui` experience.',
          shell: 'hermes chat --tui'
        },
        {
          command: 'sessions',
          title: 'Sessions',
          description: 'Launch the real `hermes sessions list` command.',
          shell: 'hermes sessions list'
        }
      ]
    },
    {
      id: 'tools-gateway',
      title: 'Tools and Gateway',
      description: 'Keep tool and gateway configuration grounded in Hermes itself instead of duplicating fake desktop settings.',
      cards: [
        {
          command: 'tools',
          title: 'Tools / Toolsets',
          description: 'Open the real `hermes tools` flow.',
          shell: 'hermes tools'
        },
        {
          command: 'gateway-setup',
          title: 'Gateway Setup',
          description: 'Open the real `hermes gateway setup` flow.',
          shell: 'hermes gateway setup'
        }
      ]
    }
  ]
}

export function App() {
  const [environment, setEnvironment] = useState<DesktopEnvironment | null>(null)
  const [runtime, setRuntime] = useState<HermesRuntimeSnapshot | null>(null)
  const [logs, setLogs] = useState<RuntimeLogTail>({ dashboard: [], gateway: [] })
  const [page, setPage] = useState<Page>(() => readStoredPage())
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale() ?? 'zh-CN')
  const [composer, setComposer] = useState('')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [sessionId, setSessionId] = useState(() => window.crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [launchingCommand, setLaunchingCommand] = useState<HermesCompanionCommand | null>(null)
  const [runtimeAction, setRuntimeAction] = useState<ActionState>(null)
  const [activeLog, setActiveLog] = useState<LogChannel>('dashboard')

  const copy = COPY[locale]
  const commandGroups = useMemo(() => getCommandGroups(locale), [locale])
  const dependencyState = useMemo(() => (runtime ? dependencySummary(runtime) : null), [runtime])

  useEffect(() => {
    let disposed = false

    async function bootstrap() {
      const desktopEnvironment = await window.desktop.getEnvironment()
      const logTail = await window.desktop.getLogTail(160)

      if (disposed) {
        return
      }

      setEnvironment(desktopEnvironment)
      setRuntime(desktopEnvironment.runtime)
      setLogs({
        dashboard: trimLogLines(logTail.dashboard),
        gateway: trimLogLines(logTail.gateway)
      })

      if (!readStoredLocale()) {
        setLocale(desktopEnvironment.locale)
      }
    }

    void bootstrap().catch((error) => {
      if (!disposed) {
        setNotice(error instanceof Error ? error.message : String(error))
      }
    })

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.page, page)
  }, [page])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.locale, locale)
  }, [locale])

  useEffect(() => {
    if (!environment) {
      return
    }

    const timer = window.setInterval(() => {
      void Promise.all([window.desktop.getRuntimeSnapshot(), window.desktop.getLogTail(160)])
        .then(([snapshot, nextLogs]) => {
          setRuntime(snapshot)
          setLogs({
            dashboard: trimLogLines(nextLogs.dashboard),
            gateway: trimLogLines(nextLogs.gateway)
          })
        })
        .catch(() => undefined)
    }, 3000)

    return () => window.clearInterval(timer)
  }, [environment])

  const historyForApi = useMemo<HermesConversationMessage[]>(
    () =>
      messages
        .filter((message) => message.status !== 'failed')
        .map((message) => ({
          role: message.role,
          content: message.content
        })),
    [messages]
  )

  async function syncRuntime(action: ActionState, result: Promise<{ snapshot: HermesRuntimeSnapshot }>) {
    setRuntimeAction(action)
    try {
      const response = await result
      setRuntime(response.snapshot)
      setNotice(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setRuntimeAction(null)
    }
  }

  async function handleLaunchCommand(command: HermesCompanionCommand) {
    setLaunchingCommand(command)
    try {
      await window.desktop.launchHermesCommand(command)
      setNotice(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setLaunchingCommand(null)
    }
  }

  async function handleSend() {
    if (runtime?.api.status !== 'ready' || !runtime.api.url || !runtime.api.apiKey || busy) {
      setNotice(copy.notices.apiUnavailable)
      return
    }

    const input = composer.trim()
    if (!input) {
      return
    }

    const apiHeaders = {
      Authorization: `Bearer ${runtime.api.apiKey}`,
      'Content-Type': 'application/json'
    }
    const assistantId = window.crypto.randomUUID()
    const nextSessionId = sessionId || window.crypto.randomUUID()

    if (!sessionId) {
      setSessionId(nextSessionId)
    }

    setBusy(true)
    setComposer('')
    setNotice(null)
    setMessages((current) => [
      ...current,
      {
        id: window.crypto.randomUUID(),
        role: 'user',
        content: input,
        status: 'completed'
      },
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        status: 'streaming'
      }
    ])

    try {
      const response = await fetch(`${runtime.api.url}/v1/runs`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          input,
          session_id: nextSessionId,
          conversation_history: historyForApi
        })
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const run = (await response.json()) as HermesRunStartResponse

      await readSseStream(`${runtime.api.url}/v1/runs/${run.run_id}/events`, apiHeaders, (event) => {
        if (event.event === 'message.delta') {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: `${message.content}${event.delta ?? ''}`
                  }
                : message
            )
          )
        }

        if (event.event === 'tool.started') {
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'tool',
              title: copy.eventLabels.toolStarted,
              detail: `${event.tool ?? copy.misc.unknown}${event.preview ? ` · ${event.preview}` : ''}`
            },
            ...current
          ])
        }

        if (event.event === 'tool.completed') {
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'tool',
              title: copy.eventLabels.toolCompleted,
              detail: `${event.tool ?? copy.misc.unknown} · ${event.duration ?? 0}s`
            },
            ...current
          ])
        }

        if (event.event === 'reasoning.available') {
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'reasoning',
              title: copy.eventLabels.reasoning,
              detail: event.text ?? ''
            },
            ...current
          ])
        }

        if (event.event === 'run.completed') {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: event.output && !message.content ? event.output : message.content,
                    status: 'completed'
                  }
                : message
            )
          )
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'status',
              title: copy.eventLabels.completed,
              detail: event.usage
                ? `in ${event.usage.input_tokens} / out ${event.usage.output_tokens}`
                : copy.eventLabels.completed
            },
            ...current
          ])
        }

        if (event.event === 'run.failed') {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: typeof event.error === 'string' ? event.error : message.content,
                    status: 'failed'
                  }
                : message
            )
          )
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'status',
              title: copy.eventLabels.failed,
              detail: typeof event.error === 'string' ? event.error : copy.eventLabels.failed
            },
            ...current
          ])
          setNotice(typeof event.error === 'string' ? event.error : copy.eventLabels.failed)
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setNotice(message)
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: message,
                status: 'failed'
              }
            : item
        )
      )
    } finally {
      setBusy(false)
    }
  }

  function handleNewSession() {
    setSessionId(window.crypto.randomUUID())
    setMessages([])
    setActivity([])
    setNotice(null)
  }

  if (!environment || !runtime || !dependencyState) {
    return <div className="loading-screen">{copy.loading}</div>
  }

  const currentLogs = activeLog === 'dashboard' ? logs.dashboard : logs.gateway
  const dashboardReady = runtime.dashboard.status === 'ready' && runtime.dashboard.url
  const apiReady = runtime.api.status === 'ready' && runtime.api.url && runtime.api.apiKey

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-mark">H</div>
          <div>
            <p className="eyebrow">Hermes Agent</p>
            <h1>{environment.productName}</h1>
            <p className="brand-copy">{copy.productTag}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="locale-switch">
            <span>{copy.localeLabel}</span>
            <div className="toggle-group">
              <button
                className={locale === 'zh-CN' ? 'active' : ''}
                onClick={() => setLocale('zh-CN')}
              >
                中文
              </button>
              <button
                className={locale === 'en-US' ? 'active' : ''}
                onClick={() => setLocale('en-US')}
              >
                EN
              </button>
            </div>
            <small>{copy.localeHint}</small>
          </div>

          <div className="runtime-actions">
            <span className={`status-pill ${statusTone(runtime.overallStatus)}`}>
              {runtimeStatusLabel(locale, runtime.overallStatus)}
            </span>
            <button
              className="primary-button"
              disabled={runtimeAction !== null}
              onClick={() => void syncRuntime('start', window.desktop.startRuntime())}
            >
              {runtimeAction === 'start' ? copy.runtime.runtimeStarting : copy.runtime.start}
            </button>
            <button
              className="secondary-button"
              disabled={runtimeAction !== null}
              onClick={() => void syncRuntime('restart', window.desktop.restartRuntime())}
            >
              {runtimeAction === 'restart' ? copy.runtime.runtimeStarting : copy.runtime.restart}
            </button>
            <button
              className="ghost-button"
              disabled={runtimeAction !== null}
              onClick={() => void syncRuntime('stop', window.desktop.stopRuntime())}
            >
              {copy.runtime.stop}
            </button>
          </div>
        </div>
      </header>

      <div className="layout-shell">
        <aside className="nav-rail">
          <nav className="nav-panel">
            <button
              className={page === 'workspace' ? 'nav-button active' : 'nav-button'}
              onClick={() => setPage('workspace')}
            >
              {copy.pages.workspace}
            </button>
            <button
              className={page === 'quick-run' ? 'nav-button active' : 'nav-button'}
              onClick={() => setPage('quick-run')}
            >
              {copy.pages.quickRun}
            </button>
            <button
              className={page === 'commands' ? 'nav-button active' : 'nav-button'}
              onClick={() => setPage('commands')}
            >
              {copy.pages.commands}
            </button>
            <button
              className={page === 'diagnostics' ? 'nav-button active' : 'nav-button'}
              onClick={() => setPage('diagnostics')}
            >
              {copy.pages.diagnostics}
            </button>
          </nav>

          <section className="rail-card">
            <div className="section-head">
              <h2>{copy.runtime.section}</h2>
              <span className={`status-pill ${statusTone(runtime.overallStatus)}`}>
                {runtimeStatusLabel(locale, runtime.overallStatus)}
              </span>
            </div>
            <div className="service-list">
              <div className="service-row">
                <span>{copy.runtime.dashboard}</span>
                <strong className={statusTone(runtime.dashboard.status)}>
                  {serviceStatusLabel(locale, runtime.dashboard.status)}
                </strong>
              </div>
              <div className="service-row">
                <span>{copy.runtime.api}</span>
                <strong className={statusTone(runtime.api.status)}>
                  {serviceStatusLabel(locale, runtime.api.status)}
                </strong>
              </div>
              <div className="service-row">
                <span>{copy.runtime.python}</span>
                <strong>{formatValue(runtime.python.version, copy.misc.unknown)}</strong>
              </div>
              <div className="service-row">
                <span>{copy.runtime.dependencies}</span>
                <strong className={dependencyState.allReady ? 'ready' : 'failed'}>
                  {dependencyState.readyCount}/{dependencyState.totalCount}
                </strong>
              </div>
            </div>
          </section>

          <section className="rail-card">
            <div className="section-head">
              <h2>{copy.runtime.sharedState}</h2>
            </div>
            <p className="muted-copy">{copy.runtime.sharedStateBody}</p>
            <div className="path-list compact">
              <div>
                <span>HERMES_HOME</span>
                <strong>{runtime.paths.hermesHome}</strong>
              </div>
              <div>
                <span>{copy.runtime.python}</span>
                <strong>{runtime.python.executable}</strong>
              </div>
            </div>
          </section>

          <section className="rail-card">
            <div className="section-head">
              <h2>{copy.runtime.tools}</h2>
            </div>
            <div className="action-list">
              <button className="secondary-button" onClick={() => void window.desktop.openHermesHome()}>
                {copy.diagnostics.openHome}
              </button>
              <button className="secondary-button" onClick={() => void window.desktop.openLogsDirectory()}>
                {copy.diagnostics.openLogs}
              </button>
              <button className="secondary-button" onClick={() => void window.desktop.openOpenSourceNotes()}>
                {copy.diagnostics.openNotes}
              </button>
            </div>
          </section>
        </aside>

        <main className="content-area">
          <section className="page-hero">
            <div>
              <p className="eyebrow">{environment.productVersion}</p>
              <h2>
                {page === 'workspace'
                  ? copy.pageCopy.workspaceTitle
                  : page === 'quick-run'
                    ? copy.pageCopy.quickRunTitle
                    : page === 'commands'
                      ? copy.pageCopy.commandsTitle
                      : copy.pageCopy.diagnosticsTitle}
              </h2>
              <p className="hero-copy">
                {page === 'workspace'
                  ? dashboardReady
                    ? copy.pageCopy.workspaceBody
                    : copy.pageCopy.workspaceWaiting
                  : page === 'quick-run'
                    ? apiReady
                      ? copy.pageCopy.quickRunBody
                      : copy.pageCopy.quickRunWaiting
                    : page === 'commands'
                      ? copy.pageCopy.commandsBody
                      : copy.pageCopy.diagnosticsBody}
              </p>
            </div>
          </section>

          {notice && <section className="notice-banner">{notice}</section>}

          {page === 'workspace' && (
            <div className="workspace-grid">
              <section className="surface-card dashboard-panel">
                {dashboardReady ? (
                  <iframe title={copy.pageCopy.workspaceTitle} src={runtime.dashboard.url ?? undefined} />
                ) : (
                  <div className="empty-panel">
                    <h3>{copy.runtime.dashboard}</h3>
                    <p>{copy.pageCopy.workspaceWaiting}</p>
                  </div>
                )}
              </section>

              <aside className="workspace-side">
                <section className="surface-card">
                  <div className="section-head">
                    <h3>{copy.misc.modelAndAuth}</h3>
                  </div>
                  <div className="mini-command-list">
                    {commandGroups[0].cards.map((card) => (
                      <button
                        key={card.command}
                        className="command-link"
                        disabled={launchingCommand === card.command}
                        onClick={() => void handleLaunchCommand(card.command)}
                      >
                        <div>
                          <strong>{card.title}</strong>
                          <span>{card.shell}</span>
                        </div>
                        <small>{launchingCommand === card.command ? copy.commands.launching : copy.misc.open}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="surface-card">
                  <div className="section-head">
                    <h3>{copy.misc.sessionsAndTerminal}</h3>
                  </div>
                  <div className="mini-command-list">
                    {commandGroups[1].cards.map((card) => (
                      <button
                        key={card.command}
                        className="command-link"
                        disabled={launchingCommand === card.command}
                        onClick={() => void handleLaunchCommand(card.command)}
                      >
                        <div>
                          <strong>{card.title}</strong>
                          <span>{card.shell}</span>
                        </div>
                        <small>{launchingCommand === card.command ? copy.commands.launching : copy.misc.open}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="surface-card">
                  <div className="section-head">
                    <h3>{copy.runtime.paths}</h3>
                  </div>
                  <div className="path-list compact">
                    <div>
                      <span>{copy.runtime.dashboard}</span>
                      <strong>{formatValue(runtime.dashboard.url, copy.runtime.offline)}</strong>
                    </div>
                    <div>
                      <span>{copy.runtime.api}</span>
                      <strong>{formatValue(runtime.api.url, copy.runtime.offline)}</strong>
                    </div>
                    <div>
                      <span>{copy.runtime.logs}</span>
                      <strong>{runtime.paths.logsDir}</strong>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          )}

          {page === 'quick-run' && (
            <div className="chat-grid">
              <section className="surface-card chat-panel">
                <div className="section-head align-start">
                  <div>
                    <p className="eyebrow">{copy.quickRun.session}</p>
                    <h3>{copy.quickRun.messages}</h3>
                  </div>
                  <button className="secondary-button" onClick={handleNewSession}>
                    {copy.quickRun.newSession}
                  </button>
                </div>

                <div className="session-pill">
                  <span>{copy.quickRun.sessionId}</span>
                  <strong>{sessionId}</strong>
                </div>

                <div className="message-stream">
                  {messages.length === 0 ? (
                    <div className="empty-panel compact">
                      <h3>{copy.quickRun.messages}</h3>
                      <p>{copy.quickRun.emptyMessages}</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <article key={message.id} className={`message-bubble ${message.role}`}>
                        <header>
                          <span>
                            {message.role === 'user'
                              ? copy.quickRun.user
                              : message.role === 'assistant'
                                ? copy.quickRun.assistant
                                : copy.quickRun.system}
                          </span>
                          <small>{message.status}</small>
                        </header>
                        <p>{message.content || (message.status === 'streaming' ? '…' : '')}</p>
                      </article>
                    ))
                  )}
                </div>

                <div className="composer-panel">
                  <textarea
                    value={composer}
                    placeholder={copy.quickRun.composerPlaceholder}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault()
                        void handleSend()
                      }
                    }}
                  />
                  <div className="composer-footer">
                    <span>{copy.quickRun.ctrlEnter}</span>
                    <button className="primary-button" disabled={busy} onClick={() => void handleSend()}>
                      {busy ? copy.quickRun.sending : copy.quickRun.send}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="chat-side">
                <section className="surface-card">
                  <div className="section-head">
                    <h3>{copy.quickRun.activity}</h3>
                    <span className={`status-pill ${statusTone(runtime.api.status)}`}>
                      {apiReady ? copy.quickRun.runReady : copy.quickRun.runWaiting}
                    </span>
                  </div>
                  <div className="activity-list">
                    {activity.length === 0 ? (
                      <div className="empty-panel compact">
                        <h3>{copy.quickRun.activity}</h3>
                        <p>{copy.quickRun.emptyActivity}</p>
                      </div>
                    ) : (
                      activity.map((item) => (
                        <article key={item.id} className={`activity-item ${item.kind}`}>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="surface-card">
                  <div className="section-head">
                    <h3>{copy.misc.toolsAndGateway}</h3>
                  </div>
                  <div className="mini-command-list">
                    {commandGroups[2].cards.map((card) => (
                      <button
                        key={card.command}
                        className="command-link"
                        disabled={launchingCommand === card.command}
                        onClick={() => void handleLaunchCommand(card.command)}
                      >
                        <div>
                          <strong>{card.title}</strong>
                          <span>{card.shell}</span>
                        </div>
                        <small>{launchingCommand === card.command ? copy.commands.launching : copy.misc.open}</small>
                      </button>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          )}

          {page === 'commands' && (
            <div className="commands-layout">
              {commandGroups.map((group) => (
                <section key={group.id} className="surface-card">
                  <div className="section-head align-start">
                    <div>
                      <h3>{group.title}</h3>
                      <p className="muted-copy">{group.description}</p>
                    </div>
                  </div>
                  <div className="command-grid">
                    {group.cards.map((card) => (
                      <article key={card.command} className="command-card">
                        <div>
                          <p className="eyebrow">{card.shell}</p>
                          <h4>{card.title}</h4>
                          <p>{card.description}</p>
                        </div>
                        <button
                          className="primary-button"
                          disabled={launchingCommand === card.command}
                          onClick={() => void handleLaunchCommand(card.command)}
                        >
                          {launchingCommand === card.command ? copy.commands.launching : copy.commands.launch}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {page === 'diagnostics' && (
            <div className="diagnostics-layout">
              <section className="surface-card">
                <div className="section-head">
                  <h3>{copy.diagnostics.serviceState}</h3>
                </div>
                <div className="status-grid">
                  <article className="status-card">
                    <span>{copy.runtime.section}</span>
                    <strong>{runtimeStatusLabel(locale, runtime.overallStatus)}</strong>
                    <small>{formatTimestamp(locale, runtime.dashboard.startedAt ?? runtime.api.startedAt)}</small>
                  </article>
                  <article className="status-card">
                    <span>{copy.runtime.dashboard}</span>
                    <strong>{serviceStatusLabel(locale, runtime.dashboard.status)}</strong>
                    <small>{formatValue(runtime.dashboard.port, copy.runtime.offline)}</small>
                  </article>
                  <article className="status-card">
                    <span>{copy.runtime.api}</span>
                    <strong>{serviceStatusLabel(locale, runtime.api.status)}</strong>
                    <small>{formatValue(runtime.api.port, copy.runtime.offline)}</small>
                  </article>
                  <article className="status-card">
                    <span>{copy.runtime.dependencies}</span>
                    <strong>
                      {dependencyState.allReady
                        ? copy.diagnostics.dependencyReady
                        : copy.diagnostics.dependencyMissing}
                    </strong>
                    <small>
                      {dependencyState.readyCount}/{dependencyState.totalCount}
                    </small>
                  </article>
                </div>
              </section>

              {(runtime.lastError || runtime.dashboard.lastError || runtime.api.lastError) && (
                <section className="surface-card warning-card">
                  <div className="section-head">
                    <h3>{copy.diagnostics.lastError}</h3>
                  </div>
                  <p>{runtime.lastError ?? runtime.dashboard.lastError ?? runtime.api.lastError}</p>
                </section>
              )}

              <section className="surface-card">
                <div className="section-head">
                  <h3>{copy.runtime.paths}</h3>
                </div>
                <div className="path-list">
                  <div>
                    <span>HERMES_HOME</span>
                    <strong>{runtime.paths.hermesHome}</strong>
                  </div>
                  <div>
                    <span>{copy.runtime.logs}</span>
                    <strong>{runtime.paths.logsDir}</strong>
                  </div>
                  <div>
                    <span>Config</span>
                    <strong>{runtime.paths.configDir}</strong>
                  </div>
                  <div>
                    <span>Data</span>
                    <strong>{runtime.paths.dataDir}</strong>
                  </div>
                  <div>
                    <span>{copy.runtime.python}</span>
                    <strong>{runtime.python.executable}</strong>
                  </div>
                  <div>
                    <span>Version</span>
                    <strong>{formatValue(runtime.python.version, copy.misc.unknown)}</strong>
                  </div>
                </div>
              </section>

              <section className="surface-card">
                <div className="section-head">
                  <h3>{copy.runtime.logs}</h3>
                  <div className="toggle-group">
                    <button
                      className={activeLog === 'dashboard' ? 'active' : ''}
                      onClick={() => setActiveLog('dashboard')}
                    >
                      {copy.diagnostics.dashboardLog}
                    </button>
                    <button
                      className={activeLog === 'gateway' ? 'active' : ''}
                      onClick={() => setActiveLog('gateway')}
                    >
                      {copy.diagnostics.gatewayLog}
                    </button>
                  </div>
                </div>
                <pre>{currentLogs.join('\n') || copy.diagnostics.noLogs}</pre>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
