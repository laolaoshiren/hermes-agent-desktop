import { useEffect, useState } from 'react'

import type {
  AppSettings,
  Locale,
  ProviderSettings,
  ProviderTestResult,
  UpdateState
} from '@product/shared'

import { getCopy } from '../lib/i18n.js'

interface SettingsPanelProps {
  locale: Locale
  productVersion: string
  runtimeVersion: string
  providerSettings: ProviderSettings
  appSettings: AppSettings
  updateState: UpdateState
  onSaveProvider: (value: ProviderSettings) => Promise<void>
  onTestProvider: (value: ProviderSettings) => Promise<ProviderTestResult>
  onSaveAppSettings: (value: AppSettings) => Promise<void>
  onCheckUpdates: () => Promise<void>
  onDownloadUpdate: () => Promise<void>
  onInstallUpdate: () => Promise<void>
  onToggleAutoUpdate: (enabled: boolean) => Promise<void>
  onOpenDataDirectory: () => Promise<void>
  onOpenLogsDirectory: () => Promise<void>
  onOpenOpenSourceNotes: () => Promise<void>
  onExportDiagnostics: () => Promise<void>
}

export function SettingsPanel({
  locale,
  productVersion,
  runtimeVersion,
  providerSettings,
  appSettings,
  updateState,
  onSaveProvider,
  onTestProvider,
  onSaveAppSettings,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onToggleAutoUpdate,
  onOpenDataDirectory,
  onOpenLogsDirectory,
  onOpenOpenSourceNotes,
  onExportDiagnostics
}: SettingsPanelProps) {
  const copy = getCopy(locale)
  const [providerDraft, setProviderDraft] = useState(providerSettings)
  const [appDraft, setAppDraft] = useState(appSettings)
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)

  useEffect(() => {
    setProviderDraft(providerSettings)
  }, [providerSettings])

  useEffect(() => {
    setAppDraft(appSettings)
  }, [appSettings])

  return (
    <div className="settings-grid">
      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.settings.model}</h3>
          <button className="primary-button compact" onClick={() => void onSaveProvider(providerDraft)}>
            {copy.common.save}
          </button>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>{copy.settings.providerType}</span>
            <select
              value={providerDraft.providerType}
              onChange={(event) =>
                setProviderDraft((current) => ({
                  ...current,
                  providerType: event.target.value as ProviderSettings['providerType']
                }))
              }
            >
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="ollama">Ollama</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.onboarding.apiKey}</span>
            <input
              type="password"
              value={providerDraft.apiKey}
              onChange={(event) =>
                setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>{copy.onboarding.baseUrl}</span>
            <input
              value={providerDraft.baseUrl}
              onChange={(event) =>
                setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>{copy.onboarding.model}</span>
            <input
              value={providerDraft.model}
              onChange={(event) =>
                setProviderDraft((current) => ({ ...current, model: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() =>
              void onTestProvider(providerDraft).then((result) => {
                setTestResult(result)
              })
            }
          >
            {copy.settings.connectionTest}
          </button>
        </div>
        {testResult && (
          <div className={testResult.success ? 'notice success' : 'notice error'}>
            <strong>{testResult.success ? copy.onboarding.connected : copy.onboarding.failed}</strong>
            <span>{testResult.message}</span>
          </div>
        )}
      </section>

      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.settings.conversation}</h3>
          <button className="primary-button compact" onClick={() => void onSaveAppSettings(appDraft)}>
            {copy.common.save}
          </button>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={appDraft.restoreLastSession}
            onChange={(event) =>
              setAppDraft((current) => ({
                ...current,
                restoreLastSession: event.target.checked
              }))
            }
          />
          <span>{copy.settings.restoreLastSession}</span>
        </label>
      </section>

      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.settings.capability}</h3>
        </div>
        <p className="muted">{copy.settings.capabilityNote}</p>
      </section>

      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.settings.appearance}</h3>
          <button className="primary-button compact" onClick={() => void onSaveAppSettings(appDraft)}>
            {copy.common.save}
          </button>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>{copy.onboarding.theme}</span>
            <select
              value={appDraft.theme}
              onChange={(event) =>
                setAppDraft((current) => ({
                  ...current,
                  theme: event.target.value as AppSettings['theme']
                }))
              }
            >
              <option value="system">{copy.onboarding.themeSystem}</option>
              <option value="light">{copy.onboarding.themeLight}</option>
              <option value="dark">{copy.onboarding.themeDark}</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.onboarding.language}</span>
            <select
              value={appDraft.locale}
              onChange={(event) =>
                setAppDraft((current) => ({
                  ...current,
                  locale: event.target.value as AppSettings['locale']
                }))
              }
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.settings.updates}</h3>
        </div>
        <div className="summary-list">
          <div>
            <strong>{copy.settings.currentVersion}</strong>
            <span>{productVersion}</span>
          </div>
          <div>
            <strong>{copy.settings.channel}</strong>
            <span>{updateState.channel}</span>
          </div>
          <div>
            <strong>{copy.settings.updateState}</strong>
            <span>{updateState.message}</span>
          </div>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={updateState.autoUpdateEnabled}
            onChange={(event) => void onToggleAutoUpdate(event.target.checked)}
          />
          <span>{copy.status.autoUpdate}</span>
        </label>
        <div className="button-row">
          <button className="secondary-button" onClick={() => void onCheckUpdates()}>
            {copy.settings.manualCheck}
          </button>
          <button className="secondary-button" onClick={() => void onDownloadUpdate()}>
            {copy.settings.downloadUpdate}
          </button>
          <button className="primary-button" onClick={() => void onInstallUpdate()}>
            {copy.settings.installUpdate}
          </button>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-head">
          <h3>{copy.settings.about}</h3>
        </div>
        <div className="summary-list">
          <div>
            <strong>{copy.settings.productVersion}</strong>
            <span>{productVersion}</span>
          </div>
          <div>
            <strong>{copy.settings.runtimeVersion}</strong>
            <span>{runtimeVersion}</span>
          </div>
        </div>
        <div className="button-row wrap">
          <button className="secondary-button" onClick={() => void onExportDiagnostics()}>
            {copy.settings.exportDiagnostics}
          </button>
          <button className="secondary-button" onClick={() => void onOpenDataDirectory()}>
            {copy.settings.openDataDirectory}
          </button>
          <button className="secondary-button" onClick={() => void onOpenLogsDirectory()}>
            {copy.settings.openLogsDirectory}
          </button>
          <button className="secondary-button" onClick={() => void onOpenOpenSourceNotes()}>
            {copy.settings.openSource}
          </button>
        </div>
      </section>
    </div>
  )
}
