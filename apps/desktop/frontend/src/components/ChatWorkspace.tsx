import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { AttachmentItem, Locale, MessageItem } from '@product/shared'

import { getCopy } from '../lib/i18n.js'

interface ChatWorkspaceProps {
  locale: Locale
  sessionTitle: string
  providerLabel: string
  updateLabel: string
  messages: MessageItem[]
  attachments: AttachmentItem[]
  sending: boolean
  canDragDrop: boolean
  onAttachFiles: (files: FileList | File[]) => Promise<void>
  onRemoveAttachment: (attachmentId: string) => Promise<void>
  onSend: (value: string) => Promise<void>
  onStop: () => Promise<void>
}

export function ChatWorkspace({
  locale,
  sessionTitle,
  providerLabel,
  updateLabel,
  messages,
  attachments,
  sending,
  canDragDrop,
  onAttachFiles,
  onRemoveAttachment,
  onSend,
  onStop
}: ChatWorkspaceProps) {
  const copy = getCopy(locale)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function submit() {
    if (!draft.trim() || sending) {
      return
    }
    const nextValue = draft
    setDraft('')
    await onSend(nextValue)
  }

  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <h2>{sessionTitle}</h2>
          <p className="muted">{providerLabel}</p>
        </div>
        <div className="status-chip">{updateLabel}</div>
      </header>

      <div
        className={canDragDrop ? 'messages-panel drag-enabled' : 'messages-panel'}
        onDragOver={(event) => {
          if (canDragDrop) {
            event.preventDefault()
          }
        }}
        onDrop={(event) => {
          if (!canDragDrop) {
            return
          }
          event.preventDefault()
          void onAttachFiles(Array.from(event.dataTransfer.files))
        }}
      >
        {messages.length === 0 ? (
          <div className="empty-chat">
            <h3>{copy.chat.emptyTitle}</h3>
            <p>{copy.chat.emptyBody}</p>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`message-bubble ${message.role}`}>
              <div className="message-role">
                {message.role === 'user' ? copy.chat.you : copy.chat.assistant}
              </div>
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content || copy.chat.generating}
                </ReactMarkdown>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="composer-panel">
        {attachments.length > 0 && (
          <div className="attachment-strip">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-chip">
                <div className="attachment-meta">
                  <strong>{attachment.name}</strong>
                  <span>{attachment.kind === 'image' ? copy.chat.image : copy.chat.file}</span>
                </div>
                <button className="ghost-button compact" onClick={() => void onRemoveAttachment(attachment.id)}>
                  {copy.chat.remove}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="composer-row">
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files?.length) {
                void onAttachFiles(event.target.files)
              }
              event.target.value = ''
            }}
          />
          <button className="secondary-button" onClick={() => inputRef.current?.click()}>
            {copy.chat.attach}
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={copy.chat.placeholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
          />
          {sending ? (
            <button className="danger-button" onClick={() => void onStop()}>
              {copy.chat.stop}
            </button>
          ) : (
            <button className="primary-button" onClick={() => void submit()}>
              {copy.chat.send}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
