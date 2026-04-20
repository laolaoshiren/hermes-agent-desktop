import { appendFile, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'

import type {
  AppPaths,
  AppSettings,
  AttachmentItem,
  CapabilitiesPayload,
  MessageItem,
  ProviderSettings,
  SessionSummary,
  SkillItem,
  ToolItem
} from '@product/shared'

interface SessionRecord extends SessionSummary {
  messages: MessageItem[]
}

interface StorePayload {
  sessions: SessionRecord[]
  attachments: AttachmentItem[]
  tools: ToolItem[]
  skills: SkillItem[]
}

const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  providerType: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  organization: '',
  extraHeaders: {}
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  locale: 'zh-CN',
  theme: 'system',
  autoUpdateEnabled: true,
  updateChannel: 'stable',
  restoreLastSession: true,
  diagnosticsPreference: 'redacted'
}

function createDefaultTools(): ToolItem[] {
  return [
    {
      id: 'file-reader',
      name: '文件理解',
      description: '允许模型读取你已附加的文件内容。',
      enabled: true,
      risk: 'low'
    },
    {
      id: 'image-reader',
      name: '图片理解',
      description: '允许模型分析图片并结合上下文回答。',
      enabled: true,
      risk: 'low'
    },
    {
      id: 'local-shell',
      name: '本地命令',
      description: '允许模型调用本地命令能力，默认建议按需开启。',
      enabled: false,
      risk: 'high'
    }
  ]
}

function createDefaultSkills(): SkillItem[] {
  return [
    {
      id: 'writing-polish',
      name: '润色写作',
      description: '帮助整理语气、结构和表达。',
      enabled: true,
      risk: 'low'
    },
    {
      id: 'meeting-summary',
      name: '会议整理',
      description: '将长文本整理成纪要、待办和重点。',
      enabled: true,
      risk: 'low'
    },
    {
      id: 'code-review',
      name: '代码审阅',
      description: '面向代码片段给出风险和修改建议。',
      enabled: false,
      risk: 'medium'
    }
  ]
}

export class DesktopStateStore {
  private readonly appSettingsFile: string
  private readonly providerSettingsFile: string
  private readonly storeFile: string
  private readonly appLogFile: string
  private readonly adapterLogFile: string
  private readonly runtimeLogFile: string
  private readonly updateLogFile: string

  constructor(private readonly paths: AppPaths) {
    this.appSettingsFile = join(paths.configDir, 'app-settings.json')
    this.providerSettingsFile = join(paths.configDir, 'provider-profiles.json')
    this.storeFile = join(paths.dataDir, 'workspace-state.json')
    this.appLogFile = join(paths.logsDir, 'app.log')
    this.adapterLogFile = join(paths.logsDir, 'adapter.log')
    this.runtimeLogFile = join(paths.logsDir, 'runtime.log')
    this.updateLogFile = join(paths.logsDir, 'update.log')
  }

  async initialize() {
    await Promise.all(
      [
        this.paths.configDir,
        this.paths.dataDir,
        this.paths.attachmentsDir,
        this.paths.logsDir,
        this.paths.exportsDir
      ].map((path) => mkdir(path, { recursive: true }))
    )

    const [providerSettings, appSettings, storePayload] = await Promise.all([
      this.readJsonFile(this.providerSettingsFile, DEFAULT_PROVIDER_SETTINGS),
      this.readJsonFile(this.appSettingsFile, DEFAULT_APP_SETTINGS),
      this.readJsonFile<StorePayload>(this.storeFile, {
        sessions: [],
        attachments: [],
        tools: createDefaultTools(),
        skills: createDefaultSkills()
      })
    ])

    await Promise.all([
      this.writeJsonFile(this.providerSettingsFile, providerSettings),
      this.writeJsonFile(this.appSettingsFile, appSettings),
      this.writeJsonFile(this.storeFile, storePayload),
      this.appendLog(this.appLogFile, '应用存储已初始化。'),
      this.appendLog(this.adapterLogFile, 'Adapter 存储已初始化。'),
      this.appendLog(this.runtimeLogFile, 'Runtime 存储已初始化。'),
      this.appendLog(this.updateLogFile, 'Update 存储已初始化。')
    ])
  }

  async getProviderSettings(): Promise<ProviderSettings> {
    return this.readJsonFile(this.providerSettingsFile, DEFAULT_PROVIDER_SETTINGS)
  }

  async saveProviderSettings(nextValue: ProviderSettings) {
    const current = await this.getProviderSettings()
    const normalized = {
      ...current,
      ...nextValue,
      apiKey: nextValue.apiKey.trim() || current.apiKey
    }
    await this.writeJsonFile(this.providerSettingsFile, normalized)
    await this.appendLog(this.adapterLogFile, '模型配置已保存。')
    return normalized
  }

  async getAppSettings(): Promise<AppSettings> {
    return this.readJsonFile(this.appSettingsFile, DEFAULT_APP_SETTINGS)
  }

  async saveAppSettings(nextValue: AppSettings) {
    await this.writeJsonFile(this.appSettingsFile, nextValue)
    await this.appendLog(this.adapterLogFile, '应用设置已保存。')
    return nextValue
  }

  async getCapabilities(): Promise<CapabilitiesPayload> {
    const payload = await this.readWorkspaceState()
    return {
      tools: payload.tools,
      skills: payload.skills
    }
  }

  async toggleCapability(type: 'tools' | 'skills', id: string, enabled: boolean) {
    const payload = await this.readWorkspaceState()
    const collection = payload[type]
    const item = collection.find((entry) => entry.id === id)
    if (!item) {
      return null
    }

    item.enabled = enabled
    await this.writeWorkspaceState(payload)
    await this.appendLog(this.adapterLogFile, `${type}:${id} -> ${enabled ? 'enabled' : 'disabled'}`)
    return item
  }

  async listSessions() {
    const payload = await this.readWorkspaceState()
    return [...payload.sessions].sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1
      }
      return right.updatedAt.localeCompare(left.updatedAt)
    })
  }

  async createSession(title = '新会话') {
    const payload = await this.readWorkspaceState()
    const session: SessionRecord = {
      id: randomUUID(),
      title,
      lastMessagePreview: '',
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      pinned: false,
      messages: []
    }
    payload.sessions.push(session)
    await this.writeWorkspaceState(payload)
    await this.appendLog(this.adapterLogFile, `创建会话 ${session.id}`)
    return session
  }

  async updateSession(
    id: string,
    patch: Partial<Pick<SessionSummary, 'title' | 'pinned'>>
  ): Promise<SessionSummary | null> {
    const payload = await this.readWorkspaceState()
    const session = payload.sessions.find((entry) => entry.id === id)
    if (!session) {
      return null
    }

    if (typeof patch.title === 'string' && patch.title.trim()) {
      session.title = patch.title.trim()
    }
    if (typeof patch.pinned === 'boolean') {
      session.pinned = patch.pinned
    }
    session.updatedAt = new Date().toISOString()
    await this.writeWorkspaceState(payload)
    return session
  }

  async deleteSession(id: string) {
    const payload = await this.readWorkspaceState()
    payload.sessions = payload.sessions.filter((entry) => entry.id !== id)
    await this.writeWorkspaceState(payload)
    await this.appendLog(this.adapterLogFile, `删除会话 ${id}`)
  }

  async getMessages(sessionId: string) {
    const payload = await this.readWorkspaceState()
    return payload.sessions.find((entry) => entry.id === sessionId)?.messages ?? null
  }

  async appendMessage(sessionId: string, message: MessageItem) {
    const payload = await this.readWorkspaceState()
    const session = payload.sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return null
    }

    session.messages.push(message)
    session.messageCount = session.messages.length
    session.lastMessagePreview = message.content.slice(0, 120)
    session.updatedAt = new Date().toISOString()
    await this.writeWorkspaceState(payload)
    return message
  }

  async updateMessage(
    sessionId: string,
    messageId: string,
    patch: Partial<Pick<MessageItem, 'content' | 'status'>>
  ): Promise<MessageItem | null> {
    const payload = await this.readWorkspaceState()
    const session = payload.sessions.find((entry) => entry.id === sessionId)
    const message = session?.messages.find((entry) => entry.id === messageId)
    if (!session || !message) {
      return null
    }

    if (typeof patch.content === 'string') {
      message.content = patch.content
    }
    if (patch.status) {
      message.status = patch.status
    }

    session.lastMessagePreview = message.content.slice(0, 120)
    session.updatedAt = new Date().toISOString()
    await this.writeWorkspaceState(payload)
    return message
  }

  async createAttachment(input: {
    name: string
    mimeType: string
    size: number
    base64: string
    previewDataUrl?: string | null
  }) {
    const payload = await this.readWorkspaceState()
    const extension = basename(input.name)
    const fileName = `${randomUUID()}-${extension}`
    const targetPath = join(this.paths.attachmentsDir, fileName)
    const normalizedBase64 = input.base64.replace(/^data:.*?;base64,/, '')
    await writeFile(targetPath, Buffer.from(normalizedBase64, 'base64'))

    const attachment: AttachmentItem = {
      id: randomUUID(),
      name: input.name,
      size: input.size,
      mimeType: input.mimeType,
      kind: input.mimeType.startsWith('image/') ? 'image' : 'file',
      status: 'prepared',
      localPath: targetPath,
      previewDataUrl: input.previewDataUrl ?? null
    }

    payload.attachments.push(attachment)
    await this.writeWorkspaceState(payload)
    await this.appendLog(this.adapterLogFile, `附件已准备 ${attachment.id}`)
    return attachment
  }

  async commitAttachments(ids: string[]) {
    const payload = await this.readWorkspaceState()
    const attachments = payload.attachments.filter((entry) => ids.includes(entry.id))
    attachments.forEach((entry) => {
      entry.status = 'committed'
    })
    await this.writeWorkspaceState(payload)
    return attachments
  }

  async deleteAttachment(id: string) {
    const payload = await this.readWorkspaceState()
    const attachment = payload.attachments.find((entry) => entry.id === id)
    if (attachment) {
      await unlink(attachment.localPath).catch(() => undefined)
    }
    payload.attachments = payload.attachments.filter((entry) => entry.id !== id)
    await this.writeWorkspaceState(payload)
  }

  async getAttachmentsByIds(ids: string[]) {
    const payload = await this.readWorkspaceState()
    return payload.attachments.filter((entry) => ids.includes(entry.id))
  }

  async getLogs() {
    const [appLog, adapterLog, runtimeLog, updateLog] = await Promise.all([
      this.readTextFile(this.appLogFile),
      this.readTextFile(this.adapterLogFile),
      this.readTextFile(this.runtimeLogFile),
      this.readTextFile(this.updateLogFile)
    ])
    return {
      appLog,
      adapterLog,
      runtimeLog,
      updateLog
    }
  }

  async appendRuntimeLog(message: string) {
    await this.appendLog(this.runtimeLogFile, message)
  }

  async appendUpdateLog(message: string) {
    await this.appendLog(this.updateLogFile, message)
  }

  async resetWorkspace() {
    await rm(this.storeFile, { force: true })
  }

  private async readWorkspaceState() {
    return this.readJsonFile<StorePayload>(this.storeFile, {
      sessions: [],
      attachments: [],
      tools: createDefaultTools(),
      skills: createDefaultSkills()
    })
  }

  private async writeWorkspaceState(nextValue: StorePayload) {
    await this.writeJsonFile(this.storeFile, nextValue)
  }

  private async readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const content = await readFile(filePath, 'utf8')
      return JSON.parse(content) as T
    } catch {
      return fallback
    }
  }

  private async writeJsonFile(filePath: string, value: unknown) {
    await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
  }

  private async readTextFile(filePath: string) {
    try {
      return await readFile(filePath, 'utf8')
    } catch {
      return ''
    }
  }

  private async appendLog(filePath: string, message: string) {
    await appendFile(filePath, `[${new Date().toISOString()}] ${message}\n`, 'utf8')
  }
}
