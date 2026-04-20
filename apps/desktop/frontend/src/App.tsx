import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type {
  DesktopEnvironment,
  HermesCompanionCommand,
  HermesConversationMessage,
  HermesRunEvent,
  HermesRuntimeSnapshot,
  Locale,
  RuntimeLogTail
} from '@product/shared'

type Page = 'console' | 'chat' | 'web' | 'bridge' | 'diagnostics'
type LogChannel = 'dashboard' | 'gateway'
type ActionState = 'start' | 'restart' | 'stop' | null
type WebSurfaceId =
  | 'status'
  | 'sessions'
  | 'analytics'
  | 'logs'
  | 'cron'
  | 'skills'
  | 'config'
  | 'env'

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
  tone: 'primary' | 'secondary'
}

type CommandGroup = {
  id: string
  title: string
  description: string
  cards: CommandCard[]
}

type WebSurface = {
  id: WebSurfaceId
  path: string
  title: string
  description: string
}

const STORAGE_KEYS = {
  page: 'hermes.desktop.page.v2',
  locale: 'hermes.desktop.locale',
  web: 'hermes.desktop.web-page'
} as const

const COPY = {
  'zh-CN': {
    loading: '正在连接 Hermes Control Desk...',
    productTag:
      '中文优先的 Hermes Agent 桌面控制台。首页回到对话与控制，不再把官方 Dashboard 当成主工作区。',
    localeLabel: '语言',
    localeHint: '默认中文，可切换英文',
    pages: {
      console: '控制台',
      chat: '对话',
      web: '官方 Web',
      bridge: '原生命令',
      diagnostics: '诊断'
    },
    hero: {
      console: {
        title: '真实 Hermes 控制台',
        body: '把运行状态、会话入口、模型与账号、技能工具、官方页面和诊断放在一个原生桌面控制面板里。'
      },
      chat: {
        title: 'Gateway 对话工作台',
        body: '这里通过真实 Hermes Gateway 发起任务，流式查看消息、工具事件和推理片段。'
      },
      web: {
        title: '官方 Web 页面',
        body: '官方 Dashboard 只保留为辅助页，用来看状态、会话、分析、日志、Cron、技能、配置和密钥。'
      },
      bridge: {
        title: '真实 CLI / TUI 命令',
        body: '每个按钮都打开真正的 Hermes 命令，不再复制一套假设置页。'
      },
      diagnostics: {
        title: '运行时与恢复',
        body: '当启动失败、依赖缺失、日志异常时，直接在这里定位和恢复。'
      }
    },
    runtime: {
      title: '运行时',
      start: '启动',
      restart: '重启',
      stop: '停止',
      ready: '就绪',
      starting: '启动中',
      failed: '失败',
      degraded: '降级',
      stopped: '已停止',
      dashboard: 'Dashboard',
      gateway: 'Gateway',
      python: 'Python',
      dependencies: '依赖',
      logs: '日志',
      paths: '路径',
      home: 'HERMES_HOME',
      readyShort: '在线',
      offline: '离线'
    },
    console: {
      surfaceTitle: '主入口应该是对话，不是 dashboard',
      surfaceBody:
        'Hermes 的主轴是对话、会话连续性、技能与工具、网关和自动化。官方 Web 适合作为观察与配置页，不该占据首页主舞台。',
      jumpChat: '进入对话',
      jumpConfig: '打开配置页',
      jumpSessions: '打开会话页',
      quickWebTitle: '官方页面入口',
      quickWebBody: '这些入口加载上游 Hermes 自带页面，不是桌面端重画一套。',
      quickCommandsTitle: '高频原生命令',
      quickCommandsBody: '模型切换、鉴权、Profile、TUI、技能和工具都直接调用真实命令。',
      quickOpsTitle: '共享运行环境',
      quickOpsBody: '桌面端、CLI/TUI、官方 Web 共用同一个 Hermes Home。'
    },
    chat: {
      session: '会话',
      sessionId: 'Session ID',
      newSession: '新会话',
      gatewayReady: 'Gateway 已连接',
      gatewayWaiting: 'Gateway 未就绪',
      onboardingTitle: '新环境先做这三步',
      onboardingBody: '如果这是第一次启动，先完成 Setup、模型/Provider 和鉴权配置，再进入真实对话。',
      composerPlaceholder:
        '给真实 Hermes Agent 发送任务，例如：扫描这个仓库，告诉我当前桌面版还缺哪些真实 Hermes 能力。',
      send: '发送给 Hermes',
      sending: '执行中...',
      messages: '消息流',
      activity: '实时事件',
      emptyMessages: '这里显示 Hermes Gateway 返回的真实消息流。',
      emptyActivity: '工具调用、推理片段和运行状态会出现在这里。',
      suggestions: '任务建议',
      suggestionsBody: '这些只是快捷填充，实际执行的仍然是 Hermes Gateway。',
      helperOnline: '支持 Markdown 输出，使用 Ctrl/Cmd + Enter 发送。',
      helperOffline: '先启动运行时，再发送真实 Hermes 任务。',
      user: '你',
      assistant: 'Hermes',
      system: '系统'
    },
    web: {
      title: '官方 Dashboard 子页面',
      body: '状态、会话、分析、日志、Cron、技能、配置、密钥都来自上游 Hermes Web UI。',
      offline: 'Dashboard 尚未启动，无法加载官方页面。',
      currentRoute: '当前路由',
      source: '来源'
    },
    bridge: {
      open: '打开命令',
      opening: '打开中...',
      footer:
        '这些操作会启动真实 Hermes CLI / TUI。Windows 下会直接打开可见终端窗口，避免点了没反馈。'
    },
    diagnostics: {
      serviceState: '服务状态',
      latestError: '最近错误',
      noLogs: '暂无日志',
      dashboardLog: 'Dashboard 日志',
      gatewayLog: 'Gateway 日志',
      dependencyReady: '依赖完整',
      dependencyMissing: '依赖缺失',
      openHome: '打开 Hermes Home',
      openLogs: '打开日志目录',
      openNotes: '开源说明'
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
    messageState: {
      idle: '待命',
      streaming: '进行中',
      completed: '完成',
      failed: '失败'
    },
    misc: {
      unknown: '未知',
      none: '无',
      official: '官方',
      open: '打开',
      launchChat: '进入对话',
      launchWeb: '切到官方 Web',
      launchBridge: '切到原生命令'
    }
  },
  'en-US': {
    loading: 'Connecting to Hermes Control Desk...',
    productTag:
      'Chinese-first desktop control console for the real Hermes Agent. Conversation stays primary while the official web UI becomes a supporting surface.',
    localeLabel: 'Language',
    localeHint: 'Chinese default, English optional',
    pages: {
      console: 'Console',
      chat: 'Chat',
      web: 'Official Web',
      bridge: 'Native Commands',
      diagnostics: 'Diagnostics'
    },
    hero: {
      console: {
        title: 'Real Hermes Control Console',
        body: 'Keep runtime state, conversation entry points, model and auth, skills, tools, official pages, and diagnostics inside one native desktop control layer.'
      },
      chat: {
        title: 'Gateway Conversation Workspace',
        body: 'Send tasks through the real Hermes Gateway and watch streaming output, tool events, and reasoning segments.'
      },
      web: {
        title: 'Official Web Pages',
        body: 'The official dashboard is kept as a supporting surface for status, sessions, analytics, logs, cron, skills, config, and keys.'
      },
      bridge: {
        title: 'Real CLI / TUI Commands',
        body: 'Every button launches a real Hermes command instead of a fake desktop settings clone.'
      },
      diagnostics: {
        title: 'Runtime and Recovery',
        body: 'Use this page to diagnose startup failures, missing dependencies, and log issues.'
      }
    },
    runtime: {
      title: 'Runtime',
      start: 'Start',
      restart: 'Restart',
      stop: 'Stop',
      ready: 'Ready',
      starting: 'Starting',
      failed: 'Failed',
      degraded: 'Degraded',
      stopped: 'Stopped',
      dashboard: 'Dashboard',
      gateway: 'Gateway',
      python: 'Python',
      dependencies: 'Dependencies',
      logs: 'Logs',
      paths: 'Paths',
      home: 'HERMES_HOME',
      readyShort: 'Online',
      offline: 'Offline'
    },
    console: {
      surfaceTitle: 'Conversation should lead, not the dashboard',
      surfaceBody:
        'Hermes is centered on conversation, session continuity, skills and tools, gateway integrations, and automation. The official web UI is valuable, but it should not own the desktop homepage.',
      jumpChat: 'Open chat',
      jumpConfig: 'Open config page',
      jumpSessions: 'Open sessions page',
      quickWebTitle: 'Official page entry points',
      quickWebBody: 'These tiles load upstream Hermes pages instead of redrawing them locally.',
      quickCommandsTitle: 'High-frequency native commands',
      quickCommandsBody: 'Model switching, auth, profiles, TUI, skills, and tools all call the real Hermes command surfaces.',
      quickOpsTitle: 'Shared runtime',
      quickOpsBody: 'Desktop, CLI/TUI, and the official web UI all share one Hermes home.'
    },
    chat: {
      session: 'Session',
      sessionId: 'Session ID',
      newSession: 'New session',
      gatewayReady: 'Gateway connected',
      gatewayWaiting: 'Gateway offline',
      onboardingTitle: 'Start with these three steps',
      onboardingBody: 'On a fresh machine, finish Setup, model/provider selection, and auth configuration before sending real Hermes tasks.',
      composerPlaceholder:
        'Send a real Hermes task, for example: inspect this repo and list the missing Hermes capabilities in the desktop app.',
      send: 'Send to Hermes',
      sending: 'Running...',
      messages: 'Message stream',
      activity: 'Live events',
      emptyMessages: 'Real Hermes Gateway messages will appear here.',
      emptyActivity: 'Tool calls, reasoning segments, and run status will appear here.',
      suggestions: 'Prompt ideas',
      suggestionsBody: 'These are only shortcuts. Execution still goes through the real Hermes Gateway.',
      helperOnline: 'Markdown output is supported. Press Ctrl/Cmd + Enter to send.',
      helperOffline: 'Start the runtime before sending real Hermes tasks.',
      user: 'You',
      assistant: 'Hermes',
      system: 'System'
    },
    web: {
      title: 'Official dashboard sub-pages',
      body: 'Status, sessions, analytics, logs, cron, skills, config, and keys come directly from the upstream Hermes web UI.',
      offline: 'The dashboard is not running, so official pages cannot be loaded.',
      currentRoute: 'Current route',
      source: 'Source'
    },
    bridge: {
      open: 'Open command',
      opening: 'Opening...',
      footer:
        'These actions launch the real Hermes CLI / TUI. On Windows they now open in a visible terminal window instead of failing silently.'
    },
    diagnostics: {
      serviceState: 'Service state',
      latestError: 'Latest error',
      noLogs: 'No logs yet',
      dashboardLog: 'Dashboard log',
      gatewayLog: 'Gateway log',
      dependencyReady: 'Dependencies ready',
      dependencyMissing: 'Dependencies missing',
      openHome: 'Open Hermes Home',
      openLogs: 'Open logs folder',
      openNotes: 'Open source notes'
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
    messageState: {
      idle: 'Idle',
      streaming: 'Streaming',
      completed: 'Completed',
      failed: 'Failed'
    },
    misc: {
      unknown: 'Unknown',
      none: 'None',
      official: 'Official',
      open: 'Open',
      launchChat: 'Go to chat',
      launchWeb: 'Go to web',
      launchBridge: 'Go to commands'
    }
  }
} as const

function trimLogLines(lines: string[]) {
  return lines.slice(-200)
}

function readStoredPage(): Page {
  const stored = window.localStorage.getItem(STORAGE_KEYS.page)
  if (
    stored === 'console' ||
    stored === 'chat' ||
    stored === 'web' ||
    stored === 'bridge' ||
    stored === 'diagnostics'
  ) {
    return stored
  }
  return 'console'
}

function readStoredLocale(): Locale | null {
  const stored = window.localStorage.getItem(STORAGE_KEYS.locale)
  if (stored === 'zh-CN' || stored === 'en-US') {
    return stored
  }
  return null
}

function readStoredWebSurface(): WebSurfaceId {
  const stored = window.localStorage.getItem(STORAGE_KEYS.web)
  if (
    stored === 'status' ||
    stored === 'sessions' ||
    stored === 'analytics' ||
    stored === 'logs' ||
    stored === 'cron' ||
    stored === 'skills' ||
    stored === 'config' ||
    stored === 'env'
  ) {
    return stored
  }
  return 'status'
}

function runtimeStatusLabel(locale: Locale, status: HermesRuntimeSnapshot['overallStatus']) {
  const copy = COPY[locale].runtime
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

function serviceStatusLabel(locale: Locale, status: 'ready' | 'starting' | 'failed' | 'stopped') {
  const copy = COPY[locale].runtime
  if (status === 'ready') {
    return copy.readyShort
  }
  if (status === 'starting') {
    return copy.starting
  }
  if (status === 'failed') {
    return copy.failed
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

function formatValue(value: string | number | null | undefined, fallback: string) {
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

function buildWebSurfaceUrl(baseUrl: string | null, path: string) {
  if (!baseUrl) {
    return null
  }
  if (path === '/') {
    return baseUrl
  }
  return `${baseUrl}${path}`
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

function getWebSurfaces(locale: Locale): WebSurface[] {
  if (locale === 'zh-CN') {
    return [
      {
        id: 'status',
        path: '/',
        title: '状态',
        description: '官方状态页，查看运行状态、活跃会话、平台连接与告警。'
      },
      {
        id: 'sessions',
        path: '/sessions',
        title: '会话',
        description: '官方会话页，搜索 transcript、展开消息和 tool call。'
      },
      {
        id: 'analytics',
        path: '/analytics',
        title: '分析',
        description: '官方分析页，查看 token、模型和时间维度统计。'
      },
      {
        id: 'logs',
        path: '/logs',
        title: '日志',
        description: '官方日志页，查看 agent、errors 与 gateway 输出。'
      },
      {
        id: 'cron',
        path: '/cron',
        title: 'Cron',
        description: '官方 Cron 页，管理定时任务、暂停、恢复和立即运行。'
      },
      {
        id: 'skills',
        path: '/skills',
        title: '技能',
        description: '官方技能页，查看已安装技能与 toolset 状态。'
      },
      {
        id: 'config',
        path: '/config',
        title: '配置',
        description: '官方配置页，支持 schema 表单、YAML、导入导出和搜索。'
      },
      {
        id: 'env',
        path: '/env',
        title: '密钥',
        description: '官方密钥页，管理 .env、Provider API Key 和 OAuth。'
      }
    ]
  }

  return [
    {
      id: 'status',
      path: '/',
      title: 'Status',
      description: 'Official status page for runtime health, sessions, platform connections, and alerts.'
    },
    {
      id: 'sessions',
      path: '/sessions',
      title: 'Sessions',
      description: 'Official sessions page for transcript search, message expansion, and tool-call review.'
    },
    {
      id: 'analytics',
      path: '/analytics',
      title: 'Analytics',
      description: 'Official analytics page for token, model, and time-based usage breakdowns.'
    },
    {
      id: 'logs',
      path: '/logs',
      title: 'Logs',
      description: 'Official logs page for agent, errors, and gateway output.'
    },
    {
      id: 'cron',
      path: '/cron',
      title: 'Cron',
      description: 'Official cron page for scheduled tasks, pause, resume, and manual runs.'
    },
    {
      id: 'skills',
      path: '/skills',
      title: 'Skills',
      description: 'Official skills page for installed skills and toolset status.'
    },
    {
      id: 'config',
      path: '/config',
      title: 'Config',
      description: 'Official config page with schema forms, YAML editing, import/export, and search.'
    },
    {
      id: 'env',
      path: '/env',
      title: 'Keys',
      description: 'Official keys page for .env variables, provider keys, and OAuth credentials.'
    }
  ]
}

function getCommandGroups(locale: Locale): CommandGroup[] {
  if (locale === 'zh-CN') {
    return [
      {
        id: 'conversation',
        title: '对话与接管',
        description: '桌面端不伪造对话能力，这些入口直接接回 Hermes 自己的 TUI 与会话体系。',
        cards: [
          {
            command: 'setup',
            title: '首次 Setup',
            description: '打开真实 `hermes setup` 引导流程。',
            shell: 'hermes setup',
            tone: 'primary'
          },
          {
            command: 'chat-tui',
            title: '原生 TUI',
            description: '打开真实 `hermes chat --tui` 对话界面。',
            shell: 'hermes chat --tui',
            tone: 'primary'
          },
          {
            command: 'sessions-browse',
            title: 'Session Browser',
            description: '打开真实 `hermes sessions browse` 会话浏览器。',
            shell: 'hermes sessions browse',
            tone: 'secondary'
          }
        ]
      },
      {
        id: 'identity',
        title: '模型与身份',
        description: '模型、Provider、鉴权池和 Profile 全部交给 Hermes 自己的原生命令。',
        cards: [
          {
            command: 'model',
            title: '模型与 Provider',
            description: '切换默认模型与推理 Provider。',
            shell: 'hermes model',
            tone: 'primary'
          },
          {
            command: 'auth',
            title: '鉴权池',
            description: '管理 API Key、OAuth 和 Provider 凭据。',
            shell: 'hermes auth',
            tone: 'secondary'
          },
          {
            command: 'profile',
            title: 'Profiles',
            description: '切换和维护不同的 Hermes Profile。',
            shell: 'hermes profile',
            tone: 'secondary'
          }
        ]
      },
      {
        id: 'tools',
        title: '技能、工具与网关',
        description: '技能开关、toolsets 和网关接入仍然基于真实 Hermes CLI。',
        cards: [
          {
            command: 'tools',
            title: 'Tools / Toolsets',
            description: '配置工具与 toolset 能力边界。',
            shell: 'hermes tools',
            tone: 'primary'
          },
          {
            command: 'skills',
            title: 'Skills',
            description: '打开技能中心，查看或调整技能能力。',
            shell: 'hermes skills',
            tone: 'secondary'
          },
          {
            command: 'gateway-setup',
            title: 'Gateway Setup',
            description: '配置 Hermes Gateway 接入与平台桥接。',
            shell: 'hermes gateway setup',
            tone: 'secondary'
          }
        ]
      },
      {
        id: 'ops',
        title: '状态与维护',
        description: '需要终端输出的检查、状态、会话列表与 Cron 管理在这里打开。',
        cards: [
          {
            command: 'sessions',
            title: 'Session List',
            description: '列出当前 Hermes 会话。',
            shell: 'hermes sessions list',
            tone: 'secondary'
          },
          {
            command: 'status',
            title: 'Status',
            description: '查看 Hermes 组件状态。',
            shell: 'hermes status',
            tone: 'secondary'
          },
          {
            command: 'doctor',
            title: 'Doctor',
            description: '运行诊断，定位配置与依赖问题。',
            shell: 'hermes doctor',
            tone: 'primary'
          },
          {
            command: 'cron',
            title: 'Cron',
            description: '打开 Cron 管理入口。',
            shell: 'hermes cron',
            tone: 'secondary'
          }
        ]
      }
    ]
  }

  return [
    {
      id: 'conversation',
      title: 'Conversation and takeover',
      description: 'The desktop shell does not fake core chat behavior. These actions connect back to Hermes TUI and session flows.',
      cards: [
        {
          command: 'setup',
          title: 'Initial setup',
          description: 'Launch the real `hermes setup` flow.',
          shell: 'hermes setup',
          tone: 'primary'
        },
        {
          command: 'chat-tui',
          title: 'Native TUI',
          description: 'Launch the real `hermes chat --tui` experience.',
          shell: 'hermes chat --tui',
          tone: 'primary'
        },
        {
          command: 'sessions-browse',
          title: 'Session browser',
          description: 'Launch the real `hermes sessions browse` picker.',
          shell: 'hermes sessions browse',
          tone: 'secondary'
        }
      ]
    },
    {
      id: 'identity',
      title: 'Model and identity',
      description: 'Model selection, provider choice, auth pools, and profiles remain grounded in Hermes itself.',
      cards: [
        {
          command: 'model',
          title: 'Model and provider',
          description: 'Switch the default model and inference provider.',
          shell: 'hermes model',
          tone: 'primary'
        },
        {
          command: 'auth',
          title: 'Auth pool',
          description: 'Manage API keys, OAuth, and provider credentials.',
          shell: 'hermes auth',
          tone: 'secondary'
        },
        {
          command: 'profile',
          title: 'Profiles',
          description: 'Switch and maintain Hermes profiles.',
          shell: 'hermes profile',
          tone: 'secondary'
        }
      ]
    },
    {
      id: 'tools',
      title: 'Skills, tools, and gateway',
      description: 'Skills, toolsets, and gateway setup stay attached to the real Hermes CLI surfaces.',
      cards: [
        {
          command: 'tools',
          title: 'Tools / Toolsets',
          description: 'Configure tool boundaries and toolset composition.',
          shell: 'hermes tools',
          tone: 'primary'
        },
        {
          command: 'skills',
          title: 'Skills',
          description: 'Open the skills center and manage capabilities.',
          shell: 'hermes skills',
          tone: 'secondary'
        },
        {
          command: 'gateway-setup',
          title: 'Gateway setup',
          description: 'Configure Hermes Gateway access and platform bridges.',
          shell: 'hermes gateway setup',
          tone: 'secondary'
        }
      ]
    },
    {
      id: 'ops',
      title: 'Status and maintenance',
      description: 'Checks, status, session listing, and cron management that belong in a terminal stay here.',
      cards: [
        {
          command: 'sessions',
          title: 'Session list',
          description: 'List current Hermes sessions.',
          shell: 'hermes sessions list',
          tone: 'secondary'
        },
        {
          command: 'status',
          title: 'Status',
          description: 'Inspect Hermes component status.',
          shell: 'hermes status',
          tone: 'secondary'
        },
        {
          command: 'doctor',
          title: 'Doctor',
          description: 'Run diagnostics against configuration and dependencies.',
          shell: 'hermes doctor',
          tone: 'primary'
        },
        {
          command: 'cron',
          title: 'Cron',
          description: 'Open the cron management entry point.',
          shell: 'hermes cron',
          tone: 'secondary'
        }
      ]
    }
  ]
}

function getSuggestionPrompts(locale: Locale) {
  if (locale === 'zh-CN') {
    return [
      '先扫描当前仓库结构，再总结这版桌面端还缺哪些真实 Hermes 能力。',
      '检查最近日志，定位 Hermes 运行时为什么会失败，并给出修复顺序。',
      '结合中文用户场景，设计一套适合当前项目的技能与工具组合建议。'
    ]
  }

  return [
    'Inspect this repo and summarize which real Hermes capabilities are still missing from the desktop app.',
    'Read the latest logs, explain why the Hermes runtime is failing, and propose a fix order.',
    'Suggest a Hermes skills and tools setup that fits a Chinese-first desktop product.'
  ]
}

function MetricCard({
  label,
  value,
  meta,
  tone
}: {
  label: string
  value: string
  meta: string
  tone: ReturnType<typeof statusTone>
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function App() {
  const [environment, setEnvironment] = useState<DesktopEnvironment | null>(null)
  const [runtime, setRuntime] = useState<HermesRuntimeSnapshot | null>(null)
  const [logs, setLogs] = useState<RuntimeLogTail>({ dashboard: [], gateway: [] })
  const [page, setPage] = useState<Page>(() => readStoredPage())
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale() ?? 'zh-CN')
  const [webSurfaceId, setWebSurfaceId] = useState<WebSurfaceId>(() => readStoredWebSurface())
  const [composer, setComposer] = useState('')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [sessionId, setSessionId] = useState(() => window.crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [launchingCommand, setLaunchingCommand] = useState<HermesCompanionCommand | null>(null)
  const [runtimeAction, setRuntimeAction] = useState<ActionState>(null)
  const [activeLog, setActiveLog] = useState<LogChannel>('dashboard')

  const messageStreamRef = useRef<HTMLDivElement | null>(null)

  const copy = COPY[locale]
  const commandGroups = useMemo(() => getCommandGroups(locale), [locale])
  const webSurfaces = useMemo(() => getWebSurfaces(locale), [locale])
  const suggestionPrompts = useMemo(() => getSuggestionPrompts(locale), [locale])
  const activeWebSurface = useMemo(
    () => webSurfaces.find((surface) => surface.id === webSurfaceId) ?? webSurfaces[0],
    [webSurfaceId, webSurfaces]
  )
  const dependencyState = useMemo(() => (runtime ? dependencySummary(runtime) : null), [runtime])

  useEffect(() => {
    let disposed = false

    async function bootstrap() {
      const desktopEnvironment = await window.desktop.getEnvironment()
      const logTail = await window.desktop.getLogTail(200)

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
    window.localStorage.setItem(STORAGE_KEYS.web, webSurfaceId)
  }, [webSurfaceId])

  useEffect(() => {
    if (!environment) {
      return
    }

    const timer = window.setInterval(() => {
      void Promise.all([window.desktop.getRuntimeSnapshot(), window.desktop.getLogTail(200)])
        .then(([snapshot, tail]) => {
          setRuntime(snapshot)
          setLogs({
            dashboard: trimLogLines(tail.dashboard),
            gateway: trimLogLines(tail.gateway)
          })
        })
        .catch(() => undefined)
    }, 3_000)

    return () => window.clearInterval(timer)
  }, [environment])

  useEffect(() => {
    if (!messageStreamRef.current) {
      return
    }
    messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight
  }, [messages])

  const conversationHistory = useMemo<HermesConversationMessage[]>(
    () =>
      messages
        .filter((message) => message.status !== 'failed')
        .map((message) => ({ role: message.role, content: message.content })),
    [messages]
  )

  async function syncRuntime(action: ActionState, promise: Promise<{ snapshot: HermesRuntimeSnapshot }>) {
    setRuntimeAction(action)
    try {
      const response = await promise
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

  function handleResetSession() {
    setSessionId(window.crypto.randomUUID())
    setMessages([])
    setActivity([])
    setNotice(null)
  }

  function handleUseSuggestion(prompt: string) {
    setComposer(prompt)
    setPage('chat')
  }

  async function handleSend() {
    if (!runtime || runtime.api.status !== 'ready' || !runtime.api.url || !runtime.api.apiKey || busy) {
      setNotice(copy.notices.apiUnavailable)
      return
    }

    const input = composer.trim()
    if (!input) {
      return
    }

    const requestHeaders = {
      Authorization: `Bearer ${runtime.api.apiKey}`,
      'Content-Type': 'application/json'
    }

    const placeholderMessageId = window.crypto.randomUUID()
    const activeSessionId = sessionId || window.crypto.randomUUID()
    if (!sessionId) {
      setSessionId(activeSessionId)
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
        id: placeholderMessageId,
        role: 'assistant',
        content: '',
        status: 'streaming'
      }
    ])

    try {
      const createRun = await fetch(`${runtime.api.url}/v1/runs`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          input,
          session_id: activeSessionId,
          conversation_history: conversationHistory
        })
      })

      if (!createRun.ok) {
        throw new Error(await createRun.text())
      }

      const created = (await createRun.json()) as { run_id: string; status: 'started' }
      await readSseStream(`${runtime.api.url}/v1/runs/${created.run_id}/events`, requestHeaders, (event) => {
        if (event.event === 'message.delta') {
          setMessages((current) =>
            current.map((message) =>
              message.id === placeholderMessageId
                ? { ...message, content: `${message.content}${event.delta ?? ''}` }
                : message
            )
          )
          return
        }

        if (event.event === 'tool.started') {
          setActivity((current) =>
            [
              {
                id: `${event.run_id}-${event.timestamp}-${current.length}`,
                kind: 'tool',
                title: copy.eventLabels.toolStarted,
                detail: `${event.tool ?? copy.misc.unknown}${event.preview ? ` · ${event.preview}` : ''}`
              },
              ...current
            ].slice(0, 80)
          )
          return
        }

        if (event.event === 'tool.completed') {
          setActivity((current) =>
            [
              {
                id: `${event.run_id}-${event.timestamp}-${current.length}`,
                kind: 'tool',
                title: copy.eventLabels.toolCompleted,
                detail: `${event.tool ?? copy.misc.unknown}${event.duration ? ` · ${event.duration}s` : ''}`
              },
              ...current
            ].slice(0, 80)
          )
          return
        }

        if (event.event === 'reasoning.available') {
          setActivity((current) =>
            [
              {
                id: `${event.run_id}-${event.timestamp}-${current.length}`,
                kind: 'reasoning',
                title: copy.eventLabels.reasoning,
                detail: event.text ?? ''
              },
              ...current
            ].slice(0, 80)
          )
          return
        }

        if (event.event === 'run.completed') {
          setMessages((current) =>
            current.map((message) =>
              message.id === placeholderMessageId
                ? {
                    ...message,
                    content: event.output && !message.content ? event.output : message.content,
                    status: 'completed'
                  }
                : message
            )
          )
          setActivity((current) =>
            [
              {
                id: `${event.run_id}-${event.timestamp}-${current.length}`,
                kind: 'status',
                title: copy.eventLabels.completed,
                detail: event.usage
                  ? `in ${event.usage.input_tokens} / out ${event.usage.output_tokens}`
                  : copy.eventLabels.completed
              },
              ...current
            ].slice(0, 80)
          )
          return
        }

        if (event.event === 'run.failed') {
          const failure = typeof event.error === 'string' ? event.error : copy.eventLabels.failed
          setMessages((current) =>
            current.map((message) =>
              message.id === placeholderMessageId ? { ...message, content: failure, status: 'failed' } : message
            )
          )
          setActivity((current) =>
            [
              {
                id: `${event.run_id}-${event.timestamp}-${current.length}`,
                kind: 'status',
                title: copy.eventLabels.failed,
                detail: failure
              },
              ...current
            ].slice(0, 80)
          )
          setNotice(failure)
        }
      })
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error)
      setNotice(failure)
      setMessages((current) =>
        current.map((message) =>
          message.id === placeholderMessageId ? { ...message, content: failure, status: 'failed' } : message
        )
      )
    } finally {
      setBusy(false)
    }
  }

  if (!environment || !runtime || !dependencyState) {
    return <div className="loading-screen">{copy.loading}</div>
  }

  const dashboardReady = runtime.dashboard.status === 'ready' && Boolean(runtime.dashboard.url)
  const apiReady = runtime.api.status === 'ready' && Boolean(runtime.api.url) && Boolean(runtime.api.apiKey)
  const currentLogs = activeLog === 'dashboard' ? logs.dashboard : logs.gateway
  const webFrameSrc = buildWebSurfaceUrl(runtime.dashboard.url, activeWebSurface.path)
  const quickCommandCards = commandGroups.flatMap((group) => group.cards).slice(0, 6)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-mark">HC</div>
          <div className="brand-copy-wrap">
            <p className="eyebrow">Hermes Agent</p>
            <h1>{environment.productName}</h1>
            <p className="brand-copy">{copy.productTag}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="locale-switch">
            <span>{copy.localeLabel}</span>
            <div className="toggle-group">
              <button className={locale === 'zh-CN' ? 'active' : ''} onClick={() => setLocale('zh-CN')}>
                中文
              </button>
              <button className={locale === 'en-US' ? 'active' : ''} onClick={() => setLocale('en-US')}>
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
              {runtimeAction === 'start' ? copy.runtime.starting : copy.runtime.start}
            </button>
            <button
              className="secondary-button"
              disabled={runtimeAction !== null}
              onClick={() => void syncRuntime('restart', window.desktop.restartRuntime())}
            >
              {runtimeAction === 'restart' ? copy.runtime.starting : copy.runtime.restart}
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
            <button className={page === 'console' ? 'nav-button active' : 'nav-button'} onClick={() => setPage('console')}>
              {copy.pages.console}
            </button>
            <button className={page === 'chat' ? 'nav-button active' : 'nav-button'} onClick={() => setPage('chat')}>
              {copy.pages.chat}
            </button>
            <button className={page === 'web' ? 'nav-button active' : 'nav-button'} onClick={() => setPage('web')}>
              {copy.pages.web}
            </button>
            <button className={page === 'bridge' ? 'nav-button active' : 'nav-button'} onClick={() => setPage('bridge')}>
              {copy.pages.bridge}
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
              <h2>{copy.runtime.title}</h2>
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
                <span>{copy.runtime.gateway}</span>
                <strong className={statusTone(runtime.api.status)}>{serviceStatusLabel(locale, runtime.api.status)}</strong>
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
              <h2>{copy.console.quickOpsTitle}</h2>
            </div>
            <p className="muted-copy">{copy.console.quickOpsBody}</p>
            <div className="path-list compact">
              <div>
                <span>{copy.runtime.home}</span>
                <strong>{runtime.paths.hermesHome}</strong>
              </div>
              <div>
                <span>{copy.runtime.python}</span>
                <strong>{runtime.python.executable}</strong>
              </div>
              <div>
                <span>Hermes</span>
                <strong>{runtime.upstreamHermesVersion}</strong>
              </div>
            </div>
          </section>

          <section className="rail-card">
            <div className="section-head">
              <h2>{copy.runtime.logs}</h2>
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
              <p className="eyebrow">
                {environment.productVersion} · {runtime.upstreamHermesVersion}
              </p>
              <h2>
                {page === 'console'
                  ? copy.hero.console.title
                  : page === 'chat'
                    ? copy.hero.chat.title
                    : page === 'web'
                      ? copy.hero.web.title
                      : page === 'bridge'
                        ? copy.hero.bridge.title
                        : copy.hero.diagnostics.title}
              </h2>
              <p className="hero-copy">
                {page === 'console'
                  ? copy.hero.console.body
                  : page === 'chat'
                    ? copy.hero.chat.body
                    : page === 'web'
                      ? copy.hero.web.body
                      : page === 'bridge'
                        ? copy.hero.bridge.body
                        : copy.hero.diagnostics.body}
              </p>
            </div>
          </section>

          {notice && <section className="notice-banner">{notice}</section>}

          {page === 'console' && (
            <div className="console-layout">
              <section className="metrics-grid">
                <MetricCard
                  label={copy.runtime.title}
                  value={runtimeStatusLabel(locale, runtime.overallStatus)}
                  meta={formatTimestamp(locale, runtime.dashboard.startedAt ?? runtime.api.startedAt)}
                  tone={statusTone(runtime.overallStatus)}
                />
                <MetricCard
                  label={copy.runtime.dashboard}
                  value={formatValue(runtime.dashboard.url, copy.runtime.offline)}
                  meta={serviceStatusLabel(locale, runtime.dashboard.status)}
                  tone={statusTone(runtime.dashboard.status)}
                />
                <MetricCard
                  label={copy.runtime.gateway}
                  value={formatValue(runtime.api.url, copy.runtime.offline)}
                  meta={serviceStatusLabel(locale, runtime.api.status)}
                  tone={statusTone(runtime.api.status)}
                />
                <MetricCard
                  label={copy.runtime.dependencies}
                  value={`${dependencyState.readyCount}/${dependencyState.totalCount}`}
                  meta={dependencyState.allReady ? copy.diagnostics.dependencyReady : copy.diagnostics.dependencyMissing}
                  tone={dependencyState.allReady ? 'ready' : 'failed'}
                />
              </section>

              <section className="surface-card spotlight-card">
                <div className="section-head align-start">
                  <div>
                    <p className="eyebrow">Hermes Desktop IA</p>
                    <h3>{copy.console.surfaceTitle}</h3>
                  </div>
                  <span className={`status-pill ${statusTone(runtime.overallStatus)}`}>
                    {runtimeStatusLabel(locale, runtime.overallStatus)}
                  </span>
                </div>
                <p className="muted-copy">{copy.console.surfaceBody}</p>
                <div className="action-row wrap">
                  <button className="primary-button" onClick={() => setPage('chat')}>
                    {copy.console.jumpChat}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setWebSurfaceId('config')
                      setPage('web')
                    }}
                  >
                    {copy.console.jumpConfig}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setWebSurfaceId('sessions')
                      setPage('web')
                    }}
                  >
                    {copy.console.jumpSessions}
                  </button>
                </div>
                <div className="path-list">
                  <div>
                    <span>{copy.runtime.home}</span>
                    <strong>{runtime.paths.hermesHome}</strong>
                  </div>
                  <div>
                    <span>{copy.runtime.dashboard}</span>
                    <strong>{formatValue(runtime.dashboard.url, copy.runtime.offline)}</strong>
                  </div>
                  <div>
                    <span>{copy.runtime.gateway}</span>
                    <strong>{formatValue(runtime.api.url, copy.runtime.offline)}</strong>
                  </div>
                </div>
              </section>

              <div className="console-panels">
                <section className="surface-card">
                  <div className="section-head align-start">
                    <div>
                      <h3>{copy.console.quickWebTitle}</h3>
                      <p className="muted-copy">{copy.console.quickWebBody}</p>
                    </div>
                  </div>
                  <div className="surface-tile-grid">
                    {webSurfaces.map((surface) => (
                      <button
                        key={surface.id}
                        className="surface-tile"
                        onClick={() => {
                          setWebSurfaceId(surface.id)
                          setPage('web')
                        }}
                      >
                        <span>{copy.misc.official}</span>
                        <strong>{surface.title}</strong>
                        <p>{surface.description}</p>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="surface-card">
                  <div className="section-head align-start">
                    <div>
                      <h3>{copy.console.quickCommandsTitle}</h3>
                      <p className="muted-copy">{copy.console.quickCommandsBody}</p>
                    </div>
                    <button className="ghost-button" onClick={() => setPage('bridge')}>
                      {copy.misc.launchBridge}
                    </button>
                  </div>
                  <div className="mini-command-list">
                    {quickCommandCards.map((card) => (
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
                        <small>{launchingCommand === card.command ? copy.bridge.opening : copy.misc.open}</small>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {page === 'chat' && (
            <div className="chat-layout">
              <section className="surface-card chat-panel">
                <div className="section-head align-start">
                  <div>
                    <p className="eyebrow">{copy.chat.session}</p>
                    <h3>{copy.chat.messages}</h3>
                  </div>
                  <button className="secondary-button" onClick={handleResetSession}>
                    {copy.chat.newSession}
                  </button>
                </div>

                <div className="session-pill">
                  <span>{copy.chat.sessionId}</span>
                  <strong>{sessionId}</strong>
                </div>

                {messages.length === 0 && (
                  <div className="suggestion-grid">
                    {suggestionPrompts.map((prompt) => (
                      <button key={prompt} className="suggestion-chip" onClick={() => handleUseSuggestion(prompt)}>
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messageStreamRef} className="message-stream">
                  {messages.length === 0 ? (
                    <div className="empty-panel compact">
                      <h3>{copy.chat.messages}</h3>
                      <p>{copy.chat.emptyMessages}</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <article key={message.id} className={`message-bubble ${message.role}`}>
                        <header>
                          <span>
                            {message.role === 'user'
                              ? copy.chat.user
                              : message.role === 'assistant'
                                ? copy.chat.assistant
                                : copy.chat.system}
                          </span>
                          <small>{copy.messageState[message.status]}</small>
                        </header>
                        {message.content ? (
                          <MarkdownMessage content={message.content} />
                        ) : (
                          <p>{message.status === 'streaming' ? '...' : ''}</p>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <div className="composer-panel">
                  <textarea
                    value={composer}
                    placeholder={copy.chat.composerPlaceholder}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault()
                        void handleSend()
                      }
                    }}
                  />
                  <div className="composer-footer">
                    <span>{apiReady ? copy.chat.helperOnline : copy.chat.helperOffline}</span>
                    <button
                      className="primary-button"
                      disabled={busy || !apiReady}
                      onClick={() => void handleSend()}
                    >
                      {busy ? copy.chat.sending : copy.chat.send}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="chat-side">
                <section className="surface-card">
                  <div className="section-head align-start">
                    <div>
                      <h3>{copy.chat.onboardingTitle}</h3>
                      <p className="muted-copy">{copy.chat.onboardingBody}</p>
                    </div>
                  </div>
                  <div className="mini-command-list">
                    {[commandGroups[0].cards[0], commandGroups[1].cards[0], commandGroups[1].cards[1]].map((card) => (
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
                        <small>{launchingCommand === card.command ? copy.bridge.opening : copy.misc.open}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="surface-card">
                  <div className="section-head">
                    <h3>{copy.chat.activity}</h3>
                    <span className={`status-pill ${statusTone(runtime.api.status)}`}>
                      {apiReady ? copy.chat.gatewayReady : copy.chat.gatewayWaiting}
                    </span>
                  </div>
                  <div className="activity-list">
                    {activity.length === 0 ? (
                      <div className="empty-panel compact">
                        <h3>{copy.chat.activity}</h3>
                        <p>{copy.chat.emptyActivity}</p>
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
                  <div className="section-head align-start">
                    <div>
                      <h3>{copy.chat.suggestions}</h3>
                      <p className="muted-copy">{copy.chat.suggestionsBody}</p>
                    </div>
                  </div>
                  <div className="mini-command-list">
                    {suggestionPrompts.map((prompt) => (
                      <button key={prompt} className="command-link" onClick={() => handleUseSuggestion(prompt)}>
                        <div>
                          <strong>{prompt}</strong>
                          <span>Hermes Gateway</span>
                        </div>
                        <small>{copy.misc.open}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="surface-card">
                  <div className="section-head align-start">
                    <div>
                      <h3>{copy.console.quickCommandsTitle}</h3>
                      <p className="muted-copy">{copy.console.quickCommandsBody}</p>
                    </div>
                  </div>
                  <div className="mini-command-list">
                    {[commandGroups[0].cards[1], commandGroups[0].cards[2], commandGroups[1].cards[0], commandGroups[3].cards[2]].map(
                      (card) => (
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
                          <small>{launchingCommand === card.command ? copy.bridge.opening : copy.misc.open}</small>
                        </button>
                      )
                    )}
                  </div>
                </section>
              </aside>
            </div>
          )}

          {page === 'web' && (
            <div className="web-layout">
              <section className="surface-card">
                <div className="section-head align-start">
                  <div>
                    <h3>{copy.web.title}</h3>
                    <p className="muted-copy">{copy.web.body}</p>
                  </div>
                  <span className={`status-pill ${statusTone(runtime.dashboard.status)}`}>
                    {serviceStatusLabel(locale, runtime.dashboard.status)}
                  </span>
                </div>

                <div className="surface-tab-row">
                  {webSurfaces.map((surface) => (
                    <button
                      key={surface.id}
                      className={surface.id === activeWebSurface.id ? 'surface-tab active' : 'surface-tab'}
                      onClick={() => setWebSurfaceId(surface.id)}
                    >
                      {surface.title}
                    </button>
                  ))}
                </div>
              </section>

              <div className="web-stage">
                <section className="surface-card web-frame-card">
                  {dashboardReady && webFrameSrc ? (
                    <iframe key={webFrameSrc} title={activeWebSurface.title} src={webFrameSrc} />
                  ) : (
                    <div className="empty-panel">
                      <h3>{copy.runtime.dashboard}</h3>
                      <p>{copy.web.offline}</p>
                    </div>
                  )}
                </section>

                <aside className="web-side">
                  <section className="surface-card">
                    <div className="section-head align-start">
                      <div>
                        <p className="eyebrow">{copy.misc.official}</p>
                        <h3>{activeWebSurface.title}</h3>
                      </div>
                    </div>
                    <p className="muted-copy">{activeWebSurface.description}</p>
                    <div className="path-list compact">
                      <div>
                        <span>{copy.web.currentRoute}</span>
                        <strong>{activeWebSurface.path}</strong>
                      </div>
                      <div>
                        <span>{copy.web.source}</span>
                        <strong>{formatValue(runtime.dashboard.url, copy.runtime.offline)}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="surface-card">
                    <div className="section-head align-start">
                      <div>
                        <h3>{copy.console.quickCommandsTitle}</h3>
                        <p className="muted-copy">{copy.console.quickCommandsBody}</p>
                      </div>
                    </div>
                    <div className="mini-command-list">
                      {commandGroups[1].cards.concat(commandGroups[2].cards.slice(0, 2)).map((card) => (
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
                          <small>{launchingCommand === card.command ? copy.bridge.opening : copy.misc.open}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {page === 'bridge' && (
            <div className="bridge-layout">
              <section className="surface-card bridge-intro">
                <div className="section-head align-start">
                  <div>
                    <h3>{copy.hero.bridge.title}</h3>
                    <p className="muted-copy">{copy.hero.bridge.body}</p>
                  </div>
                </div>
                <p className="muted-copy">{copy.bridge.footer}</p>
              </section>

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
                      <article key={card.command} className={`command-card ${card.tone}`}>
                        <div>
                          <p className="eyebrow">{card.shell}</p>
                          <h4>{card.title}</h4>
                          <p>{card.description}</p>
                        </div>
                        <button
                          className={card.tone === 'primary' ? 'primary-button' : 'secondary-button'}
                          disabled={launchingCommand === card.command}
                          onClick={() => void handleLaunchCommand(card.command)}
                        >
                          {launchingCommand === card.command ? copy.bridge.opening : copy.bridge.open}
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
                    <span>{copy.runtime.title}</span>
                    <strong>{runtimeStatusLabel(locale, runtime.overallStatus)}</strong>
                    <small>{formatTimestamp(locale, runtime.dashboard.startedAt ?? runtime.api.startedAt)}</small>
                  </article>
                  <article className="status-card">
                    <span>{copy.runtime.dashboard}</span>
                    <strong>{serviceStatusLabel(locale, runtime.dashboard.status)}</strong>
                    <small>{formatValue(runtime.dashboard.port, copy.runtime.offline)}</small>
                  </article>
                  <article className="status-card">
                    <span>{copy.runtime.gateway}</span>
                    <strong>{serviceStatusLabel(locale, runtime.api.status)}</strong>
                    <small>{formatValue(runtime.api.port, copy.runtime.offline)}</small>
                  </article>
                  <article className="status-card">
                    <span>{copy.runtime.dependencies}</span>
                    <strong>{dependencyState.allReady ? copy.diagnostics.dependencyReady : copy.diagnostics.dependencyMissing}</strong>
                    <small>
                      {dependencyState.readyCount}/{dependencyState.totalCount}
                    </small>
                  </article>
                </div>
              </section>

              {(runtime.lastError || runtime.dashboard.lastError || runtime.api.lastError) && (
                <section className="surface-card warning-card">
                  <div className="section-head">
                    <h3>{copy.diagnostics.latestError}</h3>
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
                    <span>{copy.runtime.home}</span>
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
                    <button className={activeLog === 'dashboard' ? 'active' : ''} onClick={() => setActiveLog('dashboard')}>
                      {copy.diagnostics.dashboardLog}
                    </button>
                    <button className={activeLog === 'gateway' ? 'active' : ''} onClick={() => setActiveLog('gateway')}>
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
