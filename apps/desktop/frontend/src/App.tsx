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

type Page = 'chat' | 'dashboard' | 'bridge'
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

type CompanionCard = {
  command: HermesCompanionCommand
  title: string
  description: string
}

const COPY = {
  'zh-CN': {
    productTag: '真实 Hermes Agent 桌面控制台',
    chat: '对话',
    dashboard: '控制台',
    bridge: 'TUI / CLI',
    runtime: '运行时',
    start: '启动',
    stop: '停止',
    restart: '重启',
    newSession: '新会话',
    openHome: '打开 Hermes Home',
    openLogs: '打开日志目录',
    openNotes: '开源说明',
    dashboardReady: 'Dashboard 已接入 Hermes 原生 Web UI',
    dashboardWaiting: 'Dashboard 尚未就绪，先启动 Hermes sidecar。',
    bridgeReady: '直接打开真实 Hermes CLI / TUI，管理模型、鉴权、工具、Profile 与 Sessions。',
    bridgeWaiting: '这里不会伪造功能，而是拉起真实 Hermes 终端命令。',
    apiReady: 'API Server 已接入 Hermes 原生 runs / SSE',
    apiWaiting: 'API Server 尚未就绪，无法发起真实 Hermes 对话。',
    composerPlaceholder: '向真实 Hermes Agent 发送指令，例如：扫描当前项目、修改配置、分析日志……',
    send: '发送到 Hermes',
    sending: '运行中…',
    runtimeError: '运行时错误',
    session: '会话',
    sessionId: '真实 Hermes Session',
    activity: '实时事件',
    logs: '最近日志',
    dashboardEmbed: '内嵌 Hermes Dashboard',
    logDashboard: 'Dashboard 日志',
    logGateway: 'Gateway 日志',
    emptyChat: '这里显示真实 Hermes Agent 的响应与工具事件。',
    ready: '就绪',
    starting: '启动中',
    stopped: '已停止',
    failed: '失败',
    degraded: '降级',
    python: 'Python 运行时',
    dependencies: '依赖状态',
    missingDeps: '缺少依赖，需要先补齐 Hermes Python 依赖。',
    toolStarted: '工具启动',
    toolCompleted: '工具完成',
    reasoning: '推理片段',
    completed: '运行完成',
    runFailed: '运行失败',
    localeLabel: '语言',
    copyHint: '中文优先，英文可切换',
    launch: '打开',
    launching: '打开中…',
    bridgeHint: '这些入口与桌面版共用同一个 Hermes Home、配置、会话与日志。',
    bridgeSharedState: '共享状态',
    bridgeSharedStateDesc: '同一份 HERMES_HOME，同一份真实 Hermes 数据。',
    noLogs: '暂无日志',
    noRuntime: '正在读取桌面环境…',
    noDashboard: 'Dashboard 未启动',
    noApi: 'API 未启动'
  },
  'en-US': {
    productTag: 'Desktop control console for the real Hermes Agent',
    chat: 'Chat',
    dashboard: 'Dashboard',
    bridge: 'TUI / CLI',
    runtime: 'Runtime',
    start: 'Start',
    stop: 'Stop',
    restart: 'Restart',
    newSession: 'New session',
    openHome: 'Open Hermes Home',
    openLogs: 'Open logs',
    openNotes: 'Open source notes',
    dashboardReady: 'Dashboard is powered by the native Hermes web UI.',
    dashboardWaiting: 'Dashboard is not ready yet. Start the Hermes sidecar first.',
    bridgeReady: 'Launch the real Hermes CLI / TUI to manage models, auth, tools, profiles, and sessions.',
    bridgeWaiting: 'This page opens real Hermes terminal commands instead of fake desktop-only controls.',
    apiReady: 'API Server is powered by the native Hermes runs / SSE endpoints.',
    apiWaiting: 'API Server is not ready yet, so real Hermes chat is unavailable.',
    composerPlaceholder:
      'Send a task to the real Hermes Agent, for example: inspect this repo, change config, analyze logs...',
    send: 'Send to Hermes',
    sending: 'Running…',
    runtimeError: 'Runtime error',
    session: 'Session',
    sessionId: 'Real Hermes Session',
    activity: 'Live events',
    logs: 'Recent logs',
    dashboardEmbed: 'Embedded Hermes Dashboard',
    logDashboard: 'Dashboard log',
    logGateway: 'Gateway log',
    emptyChat: 'Real Hermes Agent responses and tool activity will appear here.',
    ready: 'Ready',
    starting: 'Starting',
    stopped: 'Stopped',
    failed: 'Failed',
    degraded: 'Degraded',
    python: 'Python runtime',
    dependencies: 'Dependency status',
    missingDeps: 'Dependencies are missing. Install the Hermes Python stack first.',
    toolStarted: 'Tool started',
    toolCompleted: 'Tool completed',
    reasoning: 'Reasoning',
    completed: 'Run completed',
    runFailed: 'Run failed',
    localeLabel: 'Language',
    copyHint: 'Chinese-first, English optional',
    launch: 'Open',
    launching: 'Opening…',
    bridgeHint: 'These entrypoints share the same Hermes Home, config, sessions, and logs as the desktop app.',
    bridgeSharedState: 'Shared state',
    bridgeSharedStateDesc: 'The desktop shell and Hermes commands use one real HERMES_HOME.',
    noLogs: 'No logs yet',
    noRuntime: 'Loading desktop environment…',
    noDashboard: 'Dashboard is offline',
    noApi: 'API is offline'
  }
} as const

function getCompanionCards(locale: Locale): CompanionCard[] {
  if (locale === 'zh-CN') {
    return [
      {
        command: 'chat-tui',
        title: '真实 Hermes TUI',
        description: '打开原生终端聊天界面，直接使用 Hermes 的真实 TUI。'
      },
      {
        command: 'sessions',
        title: 'Sessions',
        description: '列出真实 Hermes 会话，和 Dashboard / TUI 共享同一份会话状态。'
      },
      {
        command: 'model',
        title: '模型与 Provider',
        description: '启动真实 `hermes model` 流程，切换模型、Provider 与凭据。'
      },
      {
        command: 'tools',
        title: 'Tools / Toolsets',
        description: '进入真实工具配置入口，管理 toolsets 与能力边界。'
      },
      {
        command: 'auth',
        title: '鉴权池',
        description: '打开真实 `hermes auth`，维护 API key、OAuth 与凭据状态。'
      },
      {
        command: 'profile',
        title: 'Profiles',
        description: '管理真实 Hermes profiles，支持多身份、多配置切换。'
      },
      {
        command: 'gateway-setup',
        title: 'Gateway Setup',
        description: '打开真实 `hermes gateway setup`，配置消息平台与接入流程。'
      }
    ]
  }

  return [
    {
      command: 'chat-tui',
      title: 'Native Hermes TUI',
      description: 'Open the real terminal chat UI shipped by Hermes Agent.'
    },
    {
      command: 'sessions',
      title: 'Sessions',
      description: 'List real Hermes sessions that are shared with the dashboard and TUI.'
    },
    {
      command: 'model',
      title: 'Model & Provider',
      description: 'Launch the real `hermes model` flow for model and provider switching.'
    },
    {
      command: 'tools',
      title: 'Tools / Toolsets',
      description: 'Open the real tool configuration surface backed by Hermes.'
    },
    {
      command: 'auth',
      title: 'Auth Pool',
      description: 'Launch `hermes auth` to manage API keys, OAuth state, and credentials.'
    },
    {
      command: 'profile',
      title: 'Profiles',
      description: 'Manage real Hermes profiles for multi-workflow and multi-identity setups.'
    },
    {
      command: 'gateway-setup',
      title: 'Gateway Setup',
      description: 'Open `hermes gateway setup` to configure real messaging platforms.'
    }
  ]
}

function trimLogLines(lines: string[]) {
  return lines.slice(-80)
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
}

function runtimeStatusLabel(locale: Locale, status: HermesRuntimeSnapshot['overallStatus']) {
  const copy = COPY[locale]
  if (status === 'ready') {
    return copy.ready
  }
  if (status === 'starting') {
    return copy.starting
  }
  if (status === 'failed') {
    return copy.failed
  }
  if (status === 'degraded') {
    return copy.degraded
  }
  return copy.stopped
}

function serviceTone(status: HermesRuntimeSnapshot['overallStatus']) {
  if (status === 'ready') {
    return 'ready'
  }
  if (status === 'starting') {
    return 'starting'
  }
  if (status === 'failed') {
    return 'failed'
  }
  return 'stopped'
}

export function App() {
  const [environment, setEnvironment] = useState<DesktopEnvironment | null>(null)
  const [runtime, setRuntime] = useState<HermesRuntimeSnapshot | null>(null)
  const [logs, setLogs] = useState<RuntimeLogTail>({ dashboard: [], gateway: [] })
  const [page, setPage] = useState<Page>('chat')
  const [locale, setLocale] = useState<Locale>('zh-CN')
  const [composer, setComposer] = useState('')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [sessionId, setSessionId] = useState(() => window.crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [launchingCommand, setLaunchingCommand] = useState<HermesCompanionCommand | null>(null)

  const copy = COPY[locale]
  const companionCards = useMemo(() => getCompanionCards(locale), [locale])

  useEffect(() => {
    let disposed = false

    async function bootstrap() {
      const desktopEnvironment = await window.desktop.getEnvironment()
      const logTail = await window.desktop.getLogTail(80)

      if (disposed) {
        return
      }

      setEnvironment(desktopEnvironment)
      setLocale(desktopEnvironment.locale)
      setRuntime(desktopEnvironment.runtime)
      setLogs({
        dashboard: trimLogLines(logTail.dashboard),
        gateway: trimLogLines(logTail.gateway)
      })
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
    if (!environment) {
      return
    }

    const timer = window.setInterval(() => {
      void Promise.all([window.desktop.getRuntimeSnapshot(), window.desktop.getLogTail(80)])
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

  async function syncRuntime(result: Promise<{ snapshot: HermesRuntimeSnapshot }>) {
    try {
      const response = await result
      setRuntime(response.snapshot)
      setNotice(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
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
      setNotice(copy.apiWaiting)
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
    setActivity([])
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
              title: copy.toolStarted,
              detail: `${event.tool ?? 'unknown'} ${event.preview ? `· ${event.preview}` : ''}`.trim()
            },
            ...current
          ])
        }

        if (event.event === 'tool.completed') {
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'tool',
              title: copy.toolCompleted,
              detail: `${event.tool ?? 'unknown'} · ${event.duration ?? 0}s`
            },
            ...current
          ])
        }

        if (event.event === 'reasoning.available') {
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'reasoning',
              title: copy.reasoning,
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
              title: copy.completed,
              detail: event.usage
                ? `in ${event.usage.input_tokens} / out ${event.usage.output_tokens}`
                : copy.completed
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
                    content: event.error && typeof event.error === 'string' ? event.error : message.content,
                    status: 'failed'
                  }
                : message
            )
          )
          setActivity((current) => [
            {
              id: `${event.run_id}-${event.timestamp}-${current.length}`,
              kind: 'status',
              title: copy.runFailed,
              detail: typeof event.error === 'string' ? event.error : copy.runFailed
            },
            ...current
          ])
          setNotice(typeof event.error === 'string' ? event.error : copy.runFailed)
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

  if (!environment || !runtime) {
    return <div className="loading-screen">{COPY['zh-CN'].noRuntime}</div>
  }

  return (
    <div className="console-shell">
      <aside className="side-column">
        <div className="brand-card">
          <p className="eyebrow">Hermes Agent</p>
          <h1>{environment.productName}</h1>
          <p className="brand-copy">{copy.productTag}</p>
          <div className="language-row">
            <span>{copy.localeLabel}</span>
            <div className="language-switch">
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
          </div>
          <p className="micro-copy">{copy.copyHint}</p>
        </div>

        <div className="panel-card">
          <div className="panel-head">
            <h2>{copy.runtime}</h2>
            <span className={`status-pill ${serviceTone(runtime.overallStatus)}`}>
              {runtimeStatusLabel(locale, runtime.overallStatus)}
            </span>
          </div>
          <div className="metrics">
            <div>
              <span>{copy.python}</span>
              <strong>{runtime.python.version ?? 'Unknown'}</strong>
            </div>
            <div>
              <span>Dashboard</span>
              <strong>{runtime.dashboard.port ?? copy.noDashboard}</strong>
            </div>
            <div>
              <span>API</span>
              <strong>{runtime.api.port ?? copy.noApi}</strong>
            </div>
          </div>
          {runtime.lastError && (
            <div className="warning-box">
              <strong>{copy.runtimeError}</strong>
              <p>{runtime.lastError}</p>
            </div>
          )}
          {runtime.python.bootstrapState === 'missing-deps' && (
            <div className="warning-box muted-box">
              <strong>{copy.dependencies}</strong>
              <p>{copy.missingDeps}</p>
            </div>
          )}
          <div className="button-stack">
            <button className="primary" onClick={() => void syncRuntime(window.desktop.startRuntime())}>
              {copy.start}
            </button>
            <button className="secondary" onClick={() => void syncRuntime(window.desktop.restartRuntime())}>
              {copy.restart}
            </button>
            <button className="ghost" onClick={() => void syncRuntime(window.desktop.stopRuntime())}>
              {copy.stop}
            </button>
          </div>
          <div className="button-stack compact">
            <button className="secondary" onClick={() => void window.desktop.openHermesHome()}>
              {copy.openHome}
            </button>
            <button className="secondary" onClick={() => void window.desktop.openLogsDirectory()}>
              {copy.openLogs}
            </button>
            <button className="secondary" onClick={() => void window.desktop.openOpenSourceNotes()}>
              {copy.openNotes}
            </button>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-head">
            <h2>{copy.logs}</h2>
          </div>
          <div className="log-block">
            <h3>{copy.logDashboard}</h3>
            <pre>{logs.dashboard.join('\n') || copy.noLogs}</pre>
          </div>
          <div className="log-block">
            <h3>{copy.logGateway}</h3>
            <pre>{logs.gateway.join('\n') || copy.noLogs}</pre>
          </div>
        </div>
      </aside>

      <section className="main-column">
        <header className="hero-card">
          <div>
            <p className="eyebrow">{copy.session}</p>
            <h2>{page === 'chat' ? copy.chat : page === 'dashboard' ? copy.dashboard : copy.bridge}</h2>
            <p className="hero-copy">
              {page === 'chat'
                ? runtime.api.status === 'ready'
                  ? copy.apiReady
                  : copy.apiWaiting
                : page === 'dashboard'
                  ? runtime.dashboard.status === 'ready'
                    ? copy.dashboardReady
                    : copy.dashboardWaiting
                  : runtime.overallStatus === 'failed'
                    ? runtime.lastError ?? copy.bridgeWaiting
                    : copy.bridgeReady}
            </p>
          </div>
          <div className="tab-row">
            <button className={page === 'chat' ? 'active' : ''} onClick={() => setPage('chat')}>
              {copy.chat}
            </button>
            <button
              className={page === 'dashboard' ? 'active' : ''}
              onClick={() => setPage('dashboard')}
            >
              {copy.dashboard}
            </button>
            <button className={page === 'bridge' ? 'active' : ''} onClick={() => setPage('bridge')}>
              {copy.bridge}
            </button>
          </div>
        </header>

        {notice && <div className="notice-banner">{notice}</div>}

        {page === 'chat' ? (
          <div className="chat-layout">
            <section className="conversation-card">
              <div className="conversation-head">
                <div>
                  <p className="eyebrow">{copy.sessionId}</p>
                  <strong>{sessionId}</strong>
                </div>
                <button className="secondary" onClick={handleNewSession}>
                  {copy.newSession}
                </button>
              </div>
              <div className="message-stream">
                {messages.length === 0 && <div className="empty-state">{copy.emptyChat}</div>}
                {messages.map((message) => (
                  <article key={message.id} className={`bubble ${message.role}`}>
                    <header>
                      <span>{message.role}</span>
                      <small>{message.status}</small>
                    </header>
                    <p>{message.content || (message.status === 'streaming' ? '...' : '')}</p>
                  </article>
                ))}
              </div>
              <div className="composer-card">
                <textarea
                  value={composer}
                  placeholder={copy.composerPlaceholder}
                  onChange={(event) => setComposer(event.target.value)}
                />
                <div className="composer-actions">
                  <button className="primary" disabled={busy} onClick={() => void handleSend()}>
                    {busy ? copy.sending : copy.send}
                  </button>
                </div>
              </div>
            </section>

            <aside className="activity-column">
              <div className="panel-card">
                <div className="panel-head">
                  <h2>{copy.activity}</h2>
                </div>
                <div className="activity-list">
                  {activity.length === 0 && <div className="empty-state">{copy.emptyChat}</div>}
                  {activity.map((item) => (
                    <article key={item.id} className={`activity-item ${item.kind}`}>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        ) : page === 'dashboard' ? (
          <section className="dashboard-card">
            {runtime.dashboard.url && runtime.dashboard.status === 'ready' ? (
              <iframe title={copy.dashboardEmbed} src={runtime.dashboard.url} />
            ) : (
              <div className="empty-state large">{copy.dashboardWaiting}</div>
            )}
          </section>
        ) : (
          <section className="bridge-layout">
            <div className="bridge-summary">
              <div className="panel-card">
                <div className="panel-head">
                  <h2>{copy.bridgeSharedState}</h2>
                </div>
                <p className="bridge-copy">{copy.bridgeSharedStateDesc}</p>
                <p className="bridge-copy">{copy.bridgeHint}</p>
                <div className="bridge-meta">
                  <div>
                    <span>Hermes Home</span>
                    <strong>{runtime.paths.hermesHome}</strong>
                  </div>
                  <div>
                    <span>Python</span>
                    <strong>{runtime.python.executable}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="bridge-grid">
              {companionCards.map((card) => (
                <article key={card.command} className="bridge-card">
                  <div>
                    <p className="eyebrow">Hermes Command</p>
                    <h3>{card.title}</h3>
                    <p className="bridge-copy">{card.description}</p>
                  </div>
                  <button
                    className="primary"
                    disabled={launchingCommand === card.command}
                    onClick={() => void handleLaunchCommand(card.command)}
                  >
                    {launchingCommand === card.command ? copy.launching : copy.launch}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  )
}
