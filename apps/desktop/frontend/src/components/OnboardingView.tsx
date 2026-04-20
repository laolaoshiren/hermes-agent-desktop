import { useState } from 'react'

import type { AppSettings, Locale, ProviderSettings, ProviderTestResult } from '@product/shared'

import { getCopy, getThemeLabel } from '../lib/i18n.js'

interface OnboardingViewProps {
  productName: string
  locale: Locale
  initialProvider: ProviderSettings
  initialSettings: AppSettings
  busy: boolean
  onTest: (provider: ProviderSettings) => Promise<ProviderTestResult>
  onComplete: (provider: ProviderSettings, settings: AppSettings) => Promise<void>
}

export function OnboardingView({
  productName,
  locale,
  initialProvider,
  initialSettings,
  busy,
  onTest,
  onComplete
}: OnboardingViewProps) {
  const copy = getCopy(locale)
  const [step, setStep] = useState(1)
  const [provider, setProvider] = useState(initialProvider)
  const [settings, setSettings] = useState(initialSettings)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)

  async function handleTestConnection() {
    setTesting(true)
    try {
      const result = await onTest(provider)
      setTestResult(result)
      if (result.success) {
        setStep(5)
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="onboarding-shell">
      <div className="onboarding-card">
        <div className="step-indicator">
          {copy.onboarding.title} · {step} / 6
        </div>

        {step === 1 && (
          <div className="stack-lg">
            <h1>{productName}</h1>
            <p className="muted">{copy.onboarding.summary}</p>
            <button className="primary-button" onClick={() => setStep(2)}>
              {copy.onboarding.start}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="stack-lg">
            <h2>{copy.onboarding.providerTitle}</h2>
            <p className="muted">{copy.onboarding.providerSummary}</p>
            <div className="provider-grid">
              {[
                ['openai', 'OpenAI'],
                ['openrouter', 'OpenRouter'],
                ['anthropic', 'Anthropic'],
                ['openai-compatible', 'OpenAI-compatible'],
                ['ollama', 'Ollama'],
                ['custom', 'Custom']
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={provider.providerType === value ? 'provider-chip active' : 'provider-chip'}
                  onClick={() =>
                    setProvider((current) => ({
                      ...current,
                      providerType: value as ProviderSettings['providerType']
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(1)}>
                {copy.common.back}
              </button>
              <button className="primary-button" onClick={() => setStep(3)}>
                {copy.common.next}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack-lg">
            <h2>{copy.onboarding.connectionTitle}</h2>
            <div className="form-grid">
              <label className="field">
                <span>{copy.onboarding.apiKey}</span>
                <input
                  type="password"
                  value={provider.apiKey}
                  onChange={(event) =>
                    setProvider((current) => ({ ...current, apiKey: event.target.value }))
                  }
                  placeholder={copy.onboarding.apiKeyPlaceholder}
                />
              </label>
              <label className="field">
                <span>{copy.onboarding.baseUrl}</span>
                <input
                  value={provider.baseUrl}
                  onChange={(event) =>
                    setProvider((current) => ({ ...current, baseUrl: event.target.value }))
                  }
                  placeholder={copy.onboarding.baseUrlPlaceholder}
                />
              </label>
              <label className="field">
                <span>{copy.onboarding.model}</span>
                <input
                  value={provider.model}
                  onChange={(event) =>
                    setProvider((current) => ({ ...current, model: event.target.value }))
                  }
                  placeholder={copy.onboarding.modelPlaceholder}
                />
              </label>
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(2)}>
                {copy.common.back}
              </button>
              <button className="primary-button" onClick={() => setStep(4)}>
                {copy.common.continue}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="stack-lg">
            <h2>{copy.onboarding.testTitle}</h2>
            <p className="muted">{copy.onboarding.testSummary}</p>
            {testResult && (
              <div className={testResult.success ? 'notice success' : 'notice error'}>
                <strong>{testResult.success ? copy.onboarding.connected : copy.onboarding.failed}</strong>
                <span>{testResult.message}</span>
              </div>
            )}
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(3)}>
                {copy.common.back}
              </button>
              <button
                className="primary-button"
                disabled={testing}
                onClick={() => void handleTestConnection()}
              >
                {testing ? copy.common.checking : copy.onboarding.runTest}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="stack-lg">
            <h2>{copy.onboarding.preferencesTitle}</h2>
            <div className="form-grid">
              <label className="field">
                <span>{copy.onboarding.theme}</span>
                <select
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings((current) => ({
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
                  value={settings.locale}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      locale: event.target.value as AppSettings['locale']
                    }))
                  }
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={settings.autoUpdateEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      autoUpdateEnabled: event.target.checked
                    }))
                  }
                />
                <span>{copy.onboarding.autoUpdate}</span>
              </label>
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(4)}>
                {copy.common.back}
              </button>
              <button className="primary-button" onClick={() => setStep(6)}>
                {copy.common.continue}
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="stack-lg">
            <h2>{copy.onboarding.finishTitle}</h2>
            <div className="summary-list">
              <div>
                <strong>{copy.onboarding.providerTitle}</strong>
                <span>{provider.providerType}</span>
              </div>
              <div>
                <strong>{copy.onboarding.model}</strong>
                <span>{provider.model || '-'}</span>
              </div>
              <div>
                <strong>{copy.onboarding.theme}</strong>
                <span>{getThemeLabel(settings.locale, settings.theme)}</span>
              </div>
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => setStep(5)}>
                {copy.common.back}
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void onComplete(provider, settings)}
              >
                {busy ? `${copy.common.save}…` : copy.onboarding.finish}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
