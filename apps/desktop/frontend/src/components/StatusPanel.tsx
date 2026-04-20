import type { BootstrapState, HealthSnapshot, Locale } from '@product/shared'

import { getCopy } from '../lib/i18n.js'

interface StatusPanelProps {
  locale: Locale
  bootstrap: BootstrapState
  health: HealthSnapshot | null
}

export function StatusPanel({ locale, bootstrap, health }: StatusPanelProps) {
  const copy = getCopy(locale)

  return (
    <div className="panel-grid">
      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.status.product}</h3>
        </div>
        <div className="summary-list">
          <div>
            <strong>{copy.status.appStatus}</strong>
            <span>{health?.appStatus ?? 'loading'}</span>
          </div>
          <div>
            <strong>{copy.status.runtimeStatus}</strong>
            <span>{bootstrap.runtime.status}</span>
          </div>
          <div>
            <strong>{copy.status.providerStatus}</strong>
            <span>{health?.providerStatus ?? 'missing'}</span>
          </div>
          <div>
            <strong>{copy.status.updateCheckedAt}</strong>
            <span>{health?.lastCheckedAt ?? copy.status.notChecked}</span>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.status.capabilities}</h3>
        </div>
        <div className="summary-list">
          <div>
            <strong>{copy.status.dragDrop}</strong>
            <span>
              {bootstrap.capabilities.supportsDragDropAttachments
                ? copy.status.available
                : copy.status.unavailable}
            </span>
          </div>
          <div>
            <strong>{copy.status.imagePaste}</strong>
            <span>
              {bootstrap.capabilities.supportsImagePaste
                ? copy.status.available
                : copy.status.unavailable}
            </span>
          </div>
          <div>
            <strong>{copy.status.secureStorage}</strong>
            <span>
              {bootstrap.capabilities.supportsSecureStorage
                ? copy.status.available
                : copy.status.degraded}
            </span>
          </div>
          <div>
            <strong>{copy.status.autoUpdate}</strong>
            <span>
              {bootstrap.capabilities.supportsAutoUpdate
                ? copy.status.available
                : copy.status.unavailable}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
