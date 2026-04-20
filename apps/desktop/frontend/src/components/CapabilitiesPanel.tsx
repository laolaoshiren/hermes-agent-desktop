import type { Locale, SkillItem, ToolItem } from '@product/shared'

import { getCopy, localizeCapability } from '../lib/i18n.js'

interface CapabilitiesPanelProps {
  locale: Locale
  tools: ToolItem[]
  skills: SkillItem[]
  onToggle: (kind: 'tools' | 'skills', id: string, enabled: boolean) => Promise<void>
}

function CapabilitySection({
  locale,
  title,
  items,
  kind,
  onToggle
}: {
  locale: Locale
  title: string
  items: Array<ToolItem | SkillItem>
  kind: 'tools' | 'skills'
  onToggle: (kind: 'tools' | 'skills', id: string, enabled: boolean) => Promise<void>
}) {
  const copy = getCopy(locale)

  return (
    <section className="panel-card">
      <div className="section-head">
        <h3>{title}</h3>
        <span className="muted">{copy.capabilities.items(items.length)}</span>
      </div>
      <div className="capability-list">
        {items.map((item) => {
          const localized = localizeCapability(kind, item, locale)
          return (
            <label key={item.id} className="capability-item">
              <div>
                <div className="capability-title-row">
                  <strong>{localized.name}</strong>
                  {item.risk && (
                    <span className={`risk-badge ${item.risk}`}>{copy.capabilities.risk[item.risk]}</span>
                  )}
                </div>
                <p className="muted">{localized.description}</p>
              </div>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(event) => void onToggle(kind, item.id, event.target.checked)}
              />
            </label>
          )
        })}
      </div>
    </section>
  )
}

export function CapabilitiesPanel({ locale, tools, skills, onToggle }: CapabilitiesPanelProps) {
  const copy = getCopy(locale)

  return (
    <div className="panel-grid">
      <CapabilitySection
        locale={locale}
        title={copy.capabilities.tools}
        items={tools}
        kind="tools"
        onToggle={onToggle}
      />
      <CapabilitySection
        locale={locale}
        title={copy.capabilities.skills}
        items={skills}
        kind="skills"
        onToggle={onToggle}
      />
    </div>
  )
}
