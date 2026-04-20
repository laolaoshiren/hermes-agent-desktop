import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'

import type {
  AppSettings,
  AttachmentItem,
  BootstrapState,
  DesktopEnvironment,
  HealthSnapshot,
  MessageItem,
  ProviderSettings,
  SessionSummary,
  SkillItem,
  StreamEvent,
  ToolItem,
  UpdateState
} from '@product/shared'

import { CapabilitiesPanel } from './components/CapabilitiesPanel.js'
import { ChatWorkspace } from './components/ChatWorkspace.js'
import { OnboardingView } from './components/OnboardingView.js'
import { SessionSidebar } from './components/SessionSidebar.js'
import { SettingsPanel } from './components/SettingsPanel.js'
import { StatusPanel } from './components/StatusPanel.js'
import { createApiClient } from './lib/api.js'
import { getCopy, getUpdateSummary } from './lib/i18n.js'

type Page = 'chat' | 'capabilities' | 'settings' | 'status'
type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

function defaultProviderSettings(): ProviderSettings {
  return {
    providerType: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
    organization: '',
    extraHeaders: {}
  }
}

function defaultAppSettings(): AppSettings {
  return {
    locale: 'zh-CN',
    theme: 'system',
    autoUpdateEnabled: true,
    updateChannel: 'stable',
    restoreLastSession: true,
    diagnosticsPreference: 'redacted'
  }
}

function updateMessageList(messages: MessageItem[], message: MessageItem) {
  const index = messages.findIndex((item) => item.id === message.id)
  if (index === -1) {
    return [...messages, message]
  }
  const next = [...messages]
  next[index] = message
  return next
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result.replace(/^data:.*?;base64,/, ''))
        return
      }
      reject(new Error('无法读取附件内容。'))
    }
    reader.onerror = () => reject(new Error('读取附件失败，请重新选择。'))
    reader.readAsDataURL(file)
  })
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('无法生成图片预览。'))
    }
    reader.onerror = () => reject(new Error('无法生成图片预览。'))
    reader.readAsDataURL(file)
  })
}

export function App() {
  const [environment, setEnvironment] = useState<DesktopEnvironment | null>(null)
  const [api, setApi] = useState<ReturnType<typeof createApiClient> | null>(null)
  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null)
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(defaultProviderSettings)
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [health, setHealth] = useState<HealthSnapshot | null>(null)
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [tools, setTools] = useState<ToolItem[]>([])
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [page, setPage] = useState<Page>('chat')
  const [search, setSearch] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([])
  const [sending, setSending] = useState(false)
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice>(null)

  const deferredSearch = useDeferredValue(search)
  const locale = appSettings.locale
  const copy = getCopy(locale)

  const filteredSessions = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase()
    if (!keyword) {
      return sessions
    }
    return sessions.filter((session) =>
      `${session.title} ${session.lastMessagePreview}`.toLowerCase().includes(keyword)
    )
  }, [deferredSearch, sessions])

  useEffect(() => {
    let disposed = false

    async function bootstrapEnvironment() {
      try {
        const desktopEnvironment = await window.desktop.getEnvironment()
        if (disposed) {
          return
        }

        const client = createApiClient(desktopEnvironment.adapterBaseUrl)
        setEnvironment(desktopEnvironment)
        setApi(client)

        const [bootstrapState, nextProvider, nextSettings, capabilities, nextSessions, nextHealth, nextUpdate] =
          await Promise.all([
            client.getBootstrapState(),
            client.getProviderSettings(),
            client.getAppSettings(),
            client.getCapabilities(),
            client.listSessions(),
            client.getHealth(),
            client.getUpdateState()
          ])

        if (disposed) {
          return
        }

        setBootstrap(bootstrapState)
        setProviderSettings(nextProvider)
        setAppSettings(nextSettings)
        setTools(capabilities.tools)
        setSkills(capabilities.skills)
        setSessions(nextSessions)
        setHealth(nextHealth)
        setUpdateState(nextUpdate)

        if (nextSessions[0]) {
          setSelectedSessionId(nextSessions[0].id)
        }
      } catch (error) {
        setNotice({
          kind: 'error',
          text: error instanceof Error ? error.message : '初始化失败，请稍后重试。'
        })
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    void bootstrapEnvironment()

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!api || !bootstrap?.onboarding.isCompleted || !selectedSessionId) {
      setMessages([])
      return
    }

    void api
      .getMessages(selectedSessionId)
      .then((items) => {
        startTransition(() => {
          setMessages(items)
        })
      })
      .catch((error) => {
        setNotice({
          kind: 'error',
          text: error instanceof Error ? error.message : '加载会话失败。'
        })
      })
  }, [api, bootstrap?.onboarding.isCompleted, selectedSessionId])

  useEffect(() => {
    const desiredTheme = appSettings.theme
    const actualTheme =
      desiredTheme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : desiredTheme

    document.documentElement.dataset.theme = actualTheme
  }, [appSettings.theme])

  useEffect(() => {
    if (!api) {
      return
    }

    const timer = window.setInterval(() => {
      void Promise.all([
        api.getBootstrapState().then(setBootstrap),
        api.getHealth().then(setHealth),
        api.getUpdateState().then(setUpdateState)
      ]).catch(() => undefined)
    }, 2000)

    return () => window.clearInterval(timer)
  }, [api])

  async function refreshSessions(nextSelectedId = selectedSessionId) {
    if (!api) {
      return
    }
    const nextSessions = await api.listSessions()
    setSessions(nextSessions)

    if (!nextSelectedId && nextSessions[0]) {
      setSelectedSessionId(nextSessions[0].id)
      return
    }
    if (nextSelectedId && nextSessions.some((session) => session.id === nextSelectedId)) {
      setSelectedSessionId(nextSelectedId)
      return
    }
    setSelectedSessionId(nextSessions[0]?.id ?? null)
  }

  async function refreshCapabilities() {
    if (!api) {
      return
    }
    const nextCapabilities = await api.getCapabilities()
    setTools(nextCapabilities.tools)
    setSkills(nextCapabilities.skills)
  }

  async function refreshSettingsAndStatus() {
    if (!api) {
      return
    }

    const [nextBootstrap, nextProvider, nextAppSettings, nextHealth, nextUpdate] = await Promise.all([
      api.getBootstrapState(),
      api.getProviderSettings(),
      api.getAppSettings(),
      api.getHealth(),
      api.getUpdateState()
    ])

    setBootstrap(nextBootstrap)
    setProviderSettings(nextProvider)
    setAppSettings(nextAppSettings)
    setHealth(nextHealth)
    setUpdateState(nextUpdate)
  }

  async function handleCompleteOnboarding(provider: ProviderSettings, settings: AppSettings) {
    if (!api) {
      return
    }

    await Promise.all([api.saveProviderSettings(provider), api.saveAppSettings(settings)])
    const session = await api.createSession(getCopy(settings.locale).common.newSession)
    setPendingAttachments([])
    setSelectedSessionId(session.id)
    await refreshSessions(session.id)
    await refreshSettingsAndStatus()
    setPage('chat')
    setNotice({ kind: 'success', text: getCopy(settings.locale).notices.onboardingDone })
  }

  async function handleCreateSession() {
    if (!api) {
      return
    }
    const session = await api.createSession(copy.common.newSession)
    await refreshSessions(session.id)
    setPage('chat')
  }

  async function handleRenameSession(session: SessionSummary) {
    if (!api) {
      return
    }
    const nextTitle = window.prompt(copy.dialogs.renameTitle, session.title)
    if (!nextTitle?.trim()) {
      return
    }
    await api.updateSession(session.id, { title: nextTitle.trim() })
    await refreshSessions(session.id)
  }

  async function handleDeleteSession(session: SessionSummary) {
    if (!api) {
      return
    }
    if (!window.confirm(copy.dialogs.deleteConfirm(session.title))) {
      return
    }
    await api.deleteSession(session.id)
    setMessages([])
    await refreshSessions()
  }

  async function handleToggleCapability(kind: 'tools' | 'skills', id: string, enabled: boolean) {
    if (!api) {
      return
    }
    await api.toggleCapability(kind, id, enabled)
    await refreshCapabilities()
  }

  async function handleAttachFiles(files: FileList | File[]) {
    if (!api) {
      return
    }

    const prepared = await Promise.all(
      Array.from(files).map(async (file) =>
        api.prepareAttachment({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          contentBase64: await toBase64(file),
          previewDataUrl: file.type.startsWith('image/') ? await toDataUrl(file) : null
        })
      )
    )

    setPendingAttachments((current) => [...current, ...prepared])
    setNotice({ kind: 'info', text: copy.notices.attached(prepared.length) })
  }

  async function handleRemoveAttachment(id: string) {
    if (!api) {
      return
    }
    await api.deleteAttachment(id)
    setPendingAttachments((current) => current.filter((item) => item.id !== id))
  }

  async function handleSendMessage(value: string) {
    if (!api) {
      return
    }

    const sessionId =
      selectedSessionId ?? (await api.createSession(copy.common.newSession).then((session) => session.id))

    if (!selectedSessionId) {
      setSelectedSessionId(sessionId)
      await refreshSessions(sessionId)
    }

    const attachmentIds = pendingAttachments.map((item) => item.id)
    if (attachmentIds.length > 0) {
      await api.commitAttachments(attachmentIds)
    }

    setPendingAttachments([])
    setSending(true)

    try {
      await api.streamMessage(
        sessionId,
        {
          text: value,
          attachmentIds,
          enabledTools: tools.filter((item) => item.enabled).map((item) => item.id),
          enabledSkills: skills.filter((item) => item.enabled).map((item) => item.id)
        },
        (event: StreamEvent) => {
          if (event.type === 'message.started') {
            const payload = event.payload as {
              userMessage: MessageItem
              assistantMessage: MessageItem
            }
            setActiveAssistantMessageId(payload.assistantMessage.id)
            setMessages((current) => [...current, payload.userMessage, payload.assistantMessage])
          }

          if (event.type === 'message.delta') {
            const payload = event.payload as { messageId: string; delta: string }
            setMessages((current) =>
              current.map((message) =>
                message.id === payload.messageId
                  ? { ...message, content: `${message.content}${payload.delta}`, status: 'streaming' }
                  : message
              )
            )
          }

          if (event.type === 'message.completed') {
            const payload = event.payload as { message: MessageItem }
            setMessages((current) => updateMessageList(current, payload.message))
            setSending(false)
            setActiveAssistantMessageId(null)
          }

          if (event.type === 'warning') {
            const payload = event.payload as { message: string }
            setNotice({ kind: 'info', text: payload.message })
          }

          if (event.type === 'error') {
            const payload = event.payload as { message: string }
            setNotice({ kind: 'error', text: payload.message })
            setSending(false)
            setActiveAssistantMessageId(null)
          }
        }
      )

      await refreshSessions(sessionId)
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : '发送消息失败。'
      })
      setSending(false)
      setActiveAssistantMessageId(null)
    }
  }

  async function handleStopMessage() {
    if (!api || !selectedSessionId || !activeAssistantMessageId) {
      return
    }
    await api.cancelMessage(selectedSessionId, activeAssistantMessageId)
  }

  async function handleSaveProvider(nextValue: ProviderSettings) {
    if (!api) {
      return
    }
    await api.saveProviderSettings(nextValue)
    await refreshSettingsAndStatus()
    setNotice({ kind: 'success', text: copy.notices.providerSaved })
  }

  async function handleTestProvider(nextValue: ProviderSettings) {
    if (!api) {
      throw new Error('Service is not ready yet.')
    }
    return api.testProviderSettings(nextValue)
  }

  async function handleSaveAppSettings(nextValue: AppSettings) {
    if (!api) {
      return
    }
    await api.saveAppSettings(nextValue)
    await refreshSettingsAndStatus()
    setNotice({ kind: 'success', text: getCopy(nextValue.locale).notices.appSaved })
  }

  async function handleCheckUpdates() {
    if (!api) {
      return
    }
    setUpdateState(await api.checkUpdates())
  }

  async function handleDownloadUpdate() {
    if (!api) {
      return
    }
    setUpdateState(await api.downloadUpdate())
  }

  async function handleInstallUpdate() {
    if (!api) {
      return
    }
    setUpdateState(await api.installUpdate())
  }

  async function handleToggleAutoUpdate(enabled: boolean) {
    if (!api) {
      return
    }
    setUpdateState(await api.toggleAutoUpdate(enabled))
    await refreshSettingsAndStatus()
  }

  async function handleExportDiagnostics() {
    if (!api) {
      return
    }
    const result = await api.exportDiagnostics()
    setNotice({ kind: 'success', text: copy.notices.diagnosticsExported(result.path) })
  }

  if (loading || !environment) {
    return <div className="loading-screen">{copy.common.loadingWorkspace}</div>
  }

  if (!bootstrap) {
    return <div className="loading-screen">读取启动信息失败。</div>
  }

  if (!bootstrap.onboarding.isCompleted) {
    return (
      <OnboardingView
        productName={bootstrap.app.productName}
        locale={locale}
        initialProvider={providerSettings}
        initialSettings={appSettings}
        busy={loading}
        onTest={handleTestProvider}
        onComplete={handleCompleteOnboarding}
      />
    )
  }

  const currentSessionTitle =
    sessions.find((session) => session.id === selectedSessionId)?.title ?? copy.common.newSession

  const providerLabel =
    locale === 'zh-CN'
      ? `模型服务商：${providerSettings.providerType} · 模型：${providerSettings.model || '未配置'}`
      : `Provider: ${providerSettings.providerType} · Model: ${providerSettings.model || 'Not configured'}`

  return (
    <div className="app-shell">
      <SessionSidebar
        productName={environment.productName}
        locale={locale}
        sessions={filteredSessions}
        currentSessionId={selectedSessionId}
        search={search}
        page={page}
        onSearchChange={setSearch}
        onCreateSession={() => void handleCreateSession()}
        onSelectSession={(id) => {
          setSelectedSessionId(id)
          setPage('chat')
        }}
        onRenameSession={(session) => void handleRenameSession(session)}
        onDeleteSession={(session) => void handleDeleteSession(session)}
        onChangePage={setPage}
      />

      <main className="main-panel">
        {notice && (
          <div className={`notice-banner ${notice.kind}`}>
            <span>{notice.text}</span>
            <button className="ghost-button compact" onClick={() => setNotice(null)}>
              {copy.common.close}
            </button>
          </div>
        )}

        {page === 'chat' && (
          <ChatWorkspace
            locale={locale}
            sessionTitle={currentSessionTitle}
            providerLabel={providerLabel}
            updateLabel={getUpdateSummary(locale, updateState)}
            messages={messages}
            attachments={pendingAttachments}
            sending={sending}
            canDragDrop={bootstrap.capabilities.supportsDragDropAttachments}
            onAttachFiles={handleAttachFiles}
            onRemoveAttachment={handleRemoveAttachment}
            onSend={handleSendMessage}
            onStop={handleStopMessage}
          />
        )}

        {page === 'capabilities' && (
          <CapabilitiesPanel
            locale={locale}
            tools={tools}
            skills={skills}
            onToggle={handleToggleCapability}
          />
        )}

        {page === 'settings' && updateState && (
          <SettingsPanel
            locale={locale}
            productVersion={environment.productVersion}
            runtimeVersion={bootstrap.runtime.runtimeVersion}
            providerSettings={providerSettings}
            appSettings={appSettings}
            updateState={updateState}
            onSaveProvider={handleSaveProvider}
            onTestProvider={handleTestProvider}
            onSaveAppSettings={handleSaveAppSettings}
            onCheckUpdates={handleCheckUpdates}
            onDownloadUpdate={handleDownloadUpdate}
            onInstallUpdate={handleInstallUpdate}
            onToggleAutoUpdate={handleToggleAutoUpdate}
            onOpenDataDirectory={() => window.desktop.openDataDirectory()}
            onOpenLogsDirectory={() => window.desktop.openLogsDirectory()}
            onOpenOpenSourceNotes={() => window.desktop.openOpenSourceNotes()}
            onExportDiagnostics={handleExportDiagnostics}
          />
        )}

        {page === 'status' && <StatusPanel locale={locale} bootstrap={bootstrap} health={health} />}
      </main>

      <aside className="right-rail">
        <section className="panel-card compact-card">
          <div className="section-head">
            <h3>{copy.rail.runtime}</h3>
          </div>
          <div className="summary-list">
            <div>
              <strong>{copy.rail.productVersion}</strong>
              <span>{environment.productVersion}</span>
            </div>
            <div>
              <strong>{copy.rail.runtimeVersion}</strong>
              <span>{bootstrap.runtime.runtimeVersion}</span>
            </div>
            <div>
              <strong>{copy.rail.currentModel}</strong>
              <span>{providerSettings.model || '-'}</span>
            </div>
          </div>
        </section>

        <section className="panel-card compact-card">
          <div className="section-head">
            <h3>{copy.rail.update}</h3>
          </div>
          <p className="muted">{getUpdateSummary(locale, updateState)}</p>
        </section>

        <section className="panel-card compact-card">
          <div className="section-head">
            <h3>{copy.rail.platform}</h3>
          </div>
          <ul className="compact-list">
            <li>
              {copy.rail.dragDrop}:
              {bootstrap.capabilities.supportsDragDropAttachments
                ? copy.status.available
                : copy.status.unavailable}
            </li>
            <li>
              {copy.rail.secureStorage}:
              {bootstrap.capabilities.supportsSecureStorage
                ? copy.status.available
                : copy.status.degraded}
            </li>
            <li>
              {copy.rail.autoUpdate}:
              {bootstrap.capabilities.supportsAutoUpdate
                ? copy.status.available
                : copy.status.unavailable}
            </li>
          </ul>
        </section>
      </aside>
    </div>
  )
}
