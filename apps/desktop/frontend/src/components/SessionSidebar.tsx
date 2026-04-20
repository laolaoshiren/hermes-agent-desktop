import type { Locale, SessionSummary } from '@product/shared'

import { getCopy } from '../lib/i18n.js'

type Page = 'chat' | 'capabilities' | 'settings' | 'status'

interface SessionSidebarProps {
  productName: string
  locale: Locale
  sessions: SessionSummary[]
  currentSessionId: string | null
  search: string
  page: Page
  onSearchChange: (value: string) => void
  onCreateSession: () => void
  onSelectSession: (id: string) => void
  onRenameSession: (session: SessionSummary) => void
  onDeleteSession: (session: SessionSummary) => void
  onChangePage: (page: Page) => void
}

const NAV_ITEMS: Array<{ key: Page }> = [
  { key: 'chat' },
  { key: 'capabilities' },
  { key: 'settings' },
  { key: 'status' }
]

export function SessionSidebar({
  productName,
  locale,
  sessions,
  currentSessionId,
  search,
  page,
  onSearchChange,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onChangePage
}: SessionSidebarProps) {
  const copy = getCopy(locale)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="eyebrow">{copy.sidebar.deskLabel}</div>
          <h1>{productName}</h1>
        </div>
        <button className="primary-button compact" onClick={onCreateSession}>
          {copy.sidebar.create}
        </button>
      </div>

      <nav className="nav-tabs">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={page === item.key ? 'tab-button active' : 'tab-button'}
            onClick={() => onChangePage(item.key)}
          >
            {copy.sidebar[item.key]}
          </button>
        ))}
      </nav>

      <label className="field">
        <span>{copy.sidebar.searchLabel}</span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={copy.sidebar.searchPlaceholder}
        />
      </label>

      <div className="session-list">
        {sessions.length === 0 && <div className="empty-sidebar">{copy.sidebar.emptySessions}</div>}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={currentSessionId === session.id ? 'session-item active' : 'session-item'}
          >
            <button className="session-main" onClick={() => onSelectSession(session.id)}>
              <strong>{session.title}</strong>
              <span>{session.lastMessagePreview || copy.common.noMessage}</span>
            </button>
            <div className="session-actions">
              <button className="ghost-button compact" onClick={() => onRenameSession(session)}>
                {copy.sidebar.rename}
              </button>
              <button className="ghost-button compact danger" onClick={() => onDeleteSession(session)}>
                {copy.sidebar.delete}
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
