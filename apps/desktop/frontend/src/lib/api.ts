import type {
  AdapterErrorResponse,
  AppSettings,
  AttachmentItem,
  BootstrapState,
  CapabilitiesPayload,
  DiagnosticsExportResult,
  HealthSnapshot,
  MessageItem,
  ProviderSettings,
  ProviderTestResult,
  SendMessageRequest,
  SessionSummary,
  StreamEvent,
  ToolItem,
  UpdateState
} from '@product/shared'

type CapabilityKind = 'tools' | 'skills'

async function parseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as AdapterErrorResponse
    return new Error(body.error.message)
  } catch {
    return new Error('请求失败，请稍后重试。')
  }
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })
  if (!response.ok) {
    throw await parseError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

function parseStreamBlock(block: string): StreamEvent | null {
  const normalized = block.trim().replaceAll('\r', '')
  if (!normalized) {
    return null
  }

  const lines = normalized.split('\n')
  const eventLine = lines.find((line) => line.startsWith('event:'))
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))

  if (!eventLine || dataLines.length === 0) {
    return null
  }

  return {
    type: eventLine.replace(/^event:\s?/, '') as StreamEvent['type'],
    payload: JSON.parse(dataLines.join('\n')) as Record<string, unknown>
  }
}

export function createApiClient(baseUrl: string) {
  return {
    getBootstrapState() {
      return request<BootstrapState>(`${baseUrl}/bootstrap-state`)
    },
    getProviderSettings() {
      return request<ProviderSettings>(`${baseUrl}/settings/provider`)
    },
    saveProviderSettings(payload: ProviderSettings) {
      return request<ProviderSettings>(`${baseUrl}/settings/provider`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    },
    testProviderSettings(payload: ProviderSettings) {
      return request<ProviderTestResult>(`${baseUrl}/settings/provider/test`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    getAppSettings() {
      return request<AppSettings>(`${baseUrl}/settings/app`)
    },
    saveAppSettings(payload: AppSettings) {
      return request<AppSettings>(`${baseUrl}/settings/app`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    },
    getCapabilities() {
      return request<CapabilitiesPayload>(`${baseUrl}/capabilities`)
    },
    toggleCapability(kind: CapabilityKind, id: string, enabled: boolean) {
      return request<ToolItem>(`${baseUrl}/capabilities/${kind}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled })
      })
    },
    listSessions() {
      return request<SessionSummary[]>(`${baseUrl}/sessions`)
    },
    createSession(title = '新会话') {
      return request<SessionSummary>(`${baseUrl}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ title })
      })
    },
    updateSession(id: string, patch: Partial<SessionSummary>) {
      return request<SessionSummary>(`${baseUrl}/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      })
    },
    deleteSession(id: string) {
      return request<void>(`${baseUrl}/sessions/${id}`, {
        method: 'DELETE'
      })
    },
    getMessages(sessionId: string) {
      return request<MessageItem[]>(`${baseUrl}/sessions/${sessionId}/messages`)
    },
    async streamMessage(
      sessionId: string,
      payload: SendMessageRequest,
      onEvent: (event: StreamEvent) => void
    ) {
      const response = await fetch(`${baseUrl}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok || !response.body) {
        throw await parseError(response)
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
          const event = parseStreamBlock(block)
          if (event) {
            onEvent(event)
          }
        }
      }

      const finalEvent = parseStreamBlock(buffer)
      if (finalEvent) {
        onEvent(finalEvent)
      }
    },
    cancelMessage(sessionId: string, messageId: string) {
      return request<{ success: boolean; state: string }>(
        `${baseUrl}/sessions/${sessionId}/messages/${messageId}/cancel`,
        {
          method: 'POST'
        }
      )
    },
    prepareAttachment(payload: {
      name: string
      mimeType: string
      size: number
      contentBase64: string
      previewDataUrl?: string | null
    }) {
      return request<AttachmentItem>(`${baseUrl}/attachments/prepare`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    commitAttachments(attachmentIds: string[]) {
      return request<AttachmentItem[]>(`${baseUrl}/attachments/commit`, {
        method: 'POST',
        body: JSON.stringify({ attachmentIds })
      })
    },
    deleteAttachment(id: string) {
      return request<void>(`${baseUrl}/attachments/${id}`, {
        method: 'DELETE'
      })
    },
    getHealth() {
      return request<HealthSnapshot>(`${baseUrl}/health`)
    },
    getUpdateState() {
      return request<UpdateState>(`${baseUrl}/updates/state`)
    },
    checkUpdates() {
      return request<UpdateState>(`${baseUrl}/updates/check`, {
        method: 'POST'
      })
    },
    downloadUpdate() {
      return request<UpdateState>(`${baseUrl}/updates/download`, {
        method: 'POST'
      })
    },
    installUpdate() {
      return request<UpdateState>(`${baseUrl}/updates/install`, {
        method: 'POST'
      })
    },
    toggleAutoUpdate(enabled: boolean) {
      return request<UpdateState>(`${baseUrl}/updates/toggle-auto`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
      })
    },
    exportDiagnostics() {
      return request<DiagnosticsExportResult>(`${baseUrl}/diagnostics/export`, {
        method: 'POST'
      })
    }
  }
}
