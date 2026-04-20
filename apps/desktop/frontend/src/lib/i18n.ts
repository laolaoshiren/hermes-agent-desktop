import type { Locale, SkillItem, ToolItem, UpdateState } from '@product/shared'

type CapabilityEntry = Record<
  string,
  Record<Locale, { name: string; description: string }>
>

const capabilityTranslations: Record<'tools' | 'skills', CapabilityEntry> = {
  tools: {
    'file-reader': {
      'zh-CN': { name: '文件理解', description: '允许模型读取你已附加的文件内容。' },
      'en-US': { name: 'File Reader', description: 'Allow the assistant to read attached files.' }
    },
    'image-reader': {
      'zh-CN': { name: '图片理解', description: '允许模型分析图片并结合上下文回答。' },
      'en-US': {
        name: 'Image Reader',
        description: 'Allow the assistant to analyze attached images.'
      }
    },
    'local-shell': {
      'zh-CN': { name: '本地命令', description: '允许模型调用本地命令能力，默认建议按需开启。' },
      'en-US': {
        name: 'Local Shell',
        description: 'Allow local command execution. Keep this disabled unless you need it.'
      }
    }
  },
  skills: {
    'writing-polish': {
      'zh-CN': { name: '润色写作', description: '帮助整理语气、结构和表达。' },
      'en-US': {
        name: 'Writing Polish',
        description: 'Improve tone, structure, and clarity for drafts.'
      }
    },
    'meeting-summary': {
      'zh-CN': { name: '会议整理', description: '将长文本整理成纪要、待办和重点。' },
      'en-US': {
        name: 'Meeting Summary',
        description: 'Turn long text into notes, actions, and key points.'
      }
    },
    'code-review': {
      'zh-CN': { name: '代码审阅', description: '面向代码片段给出风险和修改建议。' },
      'en-US': {
        name: 'Code Review',
        description: 'Review code snippets and surface risks and improvements.'
      }
    }
  }
}

const dictionary = {
  'zh-CN': {
    localeName: '简体中文',
    common: {
      close: '关闭',
      save: '保存',
      next: '下一步',
      back: '上一步',
      continue: '继续',
      checking: '测试中…',
      newSession: '新会话',
      loadingWorkspace: '正在准备桌面工作台…',
      loadingStatus: '正在读取更新状态',
      noMessage: '暂无消息'
    },
    onboarding: {
      title: '首启向导',
      start: '开始配置',
      summary: '安装完成后，你只需要配置一次模型连接信息，之后就可以直接开始使用。',
      providerTitle: '选择模型服务商',
      providerSummary: '第一版先保留主流服务商与兼容接口。',
      connectionTitle: '填写连接信息',
      apiKey: 'API Key',
      apiKeyPlaceholder: '输入你的 API Key',
      baseUrl: 'Base URL',
      baseUrlPlaceholder: '按需填写，例如兼容接口地址',
      model: '模型名',
      modelPlaceholder: '例如 gpt-4.1 或 claude-sonnet',
      testTitle: '测试连接',
      testSummary: '先校验连接信息，再进入基础偏好设置。',
      runTest: '测试连接',
      preferencesTitle: '设置基础偏好',
      theme: '主题',
      language: '语言',
      autoUpdate: '自动检查更新',
      finishTitle: '完成并进入主界面',
      finish: '完成并进入',
      connected: '连接通过',
      failed: '连接失败',
      themeSystem: '跟随系统',
      themeLight: '浅色',
      themeDark: '深色'
    },
    sidebar: {
      deskLabel: '桌面工作台',
      chat: '聊天',
      capabilities: '能力',
      settings: '设置',
      status: '状态',
      create: '新建会话',
      searchLabel: '搜索会话',
      searchPlaceholder: '按标题或预览搜索',
      rename: '重命名',
      delete: '删除',
      emptySessions: '还没有会话，可以先新建一条开始聊天。'
    },
    chat: {
      you: '你',
      assistant: '助手',
      generating: '正在生成…',
      emptyTitle: '开始一段新的对话',
      emptyBody: '可以直接输入问题，或者先附加文件和图片。',
      file: '文件',
      image: '图片',
      remove: '移除',
      attach: '添加附件',
      placeholder: '输入你的问题，Enter 发送，Shift+Enter 换行',
      stop: '停止',
      send: '发送'
    },
    capabilities: {
      tools: '工具',
      skills: '技能',
      items: (count: number) => `${count} 项`,
      risk: {
        low: '低风险',
        medium: '中风险',
        high: '高风险'
      }
    },
    settings: {
      model: '模型',
      conversation: '对话',
      capability: '能力',
      appearance: '外观',
      updates: '更新',
      about: '关于与诊断',
      providerType: '供应商类型',
      connectionTest: '连接测试',
      restoreLastSession: '恢复上次会话',
      capabilityNote: '工具和技能开关已经单独放到“能力”页，这里只保留入口说明。',
      currentVersion: '当前版本',
      channel: '更新通道',
      updateState: '更新状态',
      manualCheck: '手动检查',
      downloadUpdate: '下载更新',
      installUpdate: '立即更新',
      productVersion: '产品版本',
      runtimeVersion: '运行时版本',
      exportDiagnostics: '导出诊断包',
      openDataDirectory: '打开数据目录',
      openLogsDirectory: '打开日志目录',
      openSource: '开源说明'
    },
    status: {
      product: '产品状态',
      appStatus: '应用状态',
      runtimeStatus: '运行时状态',
      providerStatus: 'Provider 状态',
      updateCheckedAt: '上次检查更新',
      capabilities: '能力状态',
      dragDrop: '拖拽附件',
      imagePaste: '图片粘贴',
      secureStorage: '安全存储',
      autoUpdate: '自动更新',
      available: '可用',
      unavailable: '不可用',
      degraded: '降级模式',
      notChecked: '尚未检查'
    },
    rail: {
      runtime: '运行摘要',
      update: '更新状态',
      platform: '平台能力',
      productVersion: '产品版本',
      runtimeVersion: '运行时版本',
      currentModel: '当前模型',
      dragDrop: '拖拽附件',
      secureStorage: '安全存储',
      autoUpdate: '自动更新'
    },
    dialogs: {
      renameTitle: '输入新的会话名称',
      deleteConfirm: (title: string) => `确定删除“${title}”吗？`
    },
    notices: {
      onboardingDone: '模型配置已完成，可以开始聊天。',
      providerSaved: '模型设置已保存。',
      appSaved: '应用设置已保存。',
      attached: (count: number) => `已添加 ${count} 个附件。`,
      diagnosticsExported: (path: string) => `诊断包已导出到 ${path}`
    }
  },
  'en-US': {
    localeName: 'English',
    common: {
      close: 'Close',
      save: 'Save',
      next: 'Next',
      back: 'Back',
      continue: 'Continue',
      checking: 'Testing…',
      newSession: 'New Session',
      loadingWorkspace: 'Preparing your desktop workspace…',
      loadingStatus: 'Loading update state',
      noMessage: 'No messages yet'
    },
    onboarding: {
      title: 'First Launch',
      start: 'Start setup',
      summary:
        'Configure your model connection once, then return to the app anytime without extra command-line setup.',
      providerTitle: 'Choose a model provider',
      providerSummary: 'The first version keeps the main providers and compatible endpoints.',
      connectionTitle: 'Enter connection details',
      apiKey: 'API Key',
      apiKeyPlaceholder: 'Enter your API key',
      baseUrl: 'Base URL',
      baseUrlPlaceholder: 'Optional, for compatible or self-hosted endpoints',
      model: 'Model',
      modelPlaceholder: 'For example gpt-4.1 or claude-sonnet',
      testTitle: 'Test connection',
      testSummary: 'Validate the connection details before entering the workspace.',
      runTest: 'Run test',
      preferencesTitle: 'Set basic preferences',
      theme: 'Theme',
      language: 'Language',
      autoUpdate: 'Check for updates automatically',
      finishTitle: 'Finish and enter the workspace',
      finish: 'Finish setup',
      connected: 'Connection passed',
      failed: 'Connection failed',
      themeSystem: 'Follow system',
      themeLight: 'Light',
      themeDark: 'Dark'
    },
    sidebar: {
      deskLabel: 'Desktop Workspace',
      chat: 'Chat',
      capabilities: 'Capabilities',
      settings: 'Settings',
      status: 'Status',
      create: 'New Session',
      searchLabel: 'Search sessions',
      searchPlaceholder: 'Search by title or preview',
      rename: 'Rename',
      delete: 'Delete',
      emptySessions: 'No sessions yet. Create one to start chatting.'
    },
    chat: {
      you: 'You',
      assistant: 'Assistant',
      generating: 'Generating…',
      emptyTitle: 'Start a new conversation',
      emptyBody: 'Type a question or attach files and images first.',
      file: 'File',
      image: 'Image',
      remove: 'Remove',
      attach: 'Add files',
      placeholder: 'Ask anything. Enter sends, Shift+Enter adds a new line.',
      stop: 'Stop',
      send: 'Send'
    },
    capabilities: {
      tools: 'Tools',
      skills: 'Skills',
      items: (count: number) => `${count} items`,
      risk: {
        low: 'Low risk',
        medium: 'Medium risk',
        high: 'High risk'
      }
    },
    settings: {
      model: 'Model',
      conversation: 'Conversation',
      capability: 'Capabilities',
      appearance: 'Appearance',
      updates: 'Updates',
      about: 'About & Diagnostics',
      providerType: 'Provider type',
      connectionTest: 'Test connection',
      restoreLastSession: 'Restore last session',
      capabilityNote: 'Tool and skill toggles live on the dedicated capabilities page.',
      currentVersion: 'Current version',
      channel: 'Update channel',
      updateState: 'Update state',
      manualCheck: 'Check now',
      downloadUpdate: 'Download update',
      installUpdate: 'Install now',
      productVersion: 'Product version',
      runtimeVersion: 'Runtime version',
      exportDiagnostics: 'Export diagnostics',
      openDataDirectory: 'Open data folder',
      openLogsDirectory: 'Open logs folder',
      openSource: 'Open source notes'
    },
    status: {
      product: 'Product status',
      appStatus: 'App status',
      runtimeStatus: 'Runtime status',
      providerStatus: 'Provider status',
      updateCheckedAt: 'Last update check',
      capabilities: 'Capabilities',
      dragDrop: 'Drag-and-drop attachments',
      imagePaste: 'Image paste',
      secureStorage: 'Secure storage',
      autoUpdate: 'Auto update',
      available: 'Available',
      unavailable: 'Unavailable',
      degraded: 'Fallback mode',
      notChecked: 'Not checked yet'
    },
    rail: {
      runtime: 'Runtime Summary',
      update: 'Update State',
      platform: 'Platform Capabilities',
      productVersion: 'Product version',
      runtimeVersion: 'Runtime version',
      currentModel: 'Current model',
      dragDrop: 'Drag-and-drop',
      secureStorage: 'Secure storage',
      autoUpdate: 'Auto update'
    },
    dialogs: {
      renameTitle: 'Enter a new session title',
      deleteConfirm: (title: string) => `Delete "${title}"?`
    },
    notices: {
      onboardingDone: 'Model setup is complete. You can start chatting now.',
      providerSaved: 'Model settings have been saved.',
      appSaved: 'App settings have been saved.',
      attached: (count: number) => `${count} attachment(s) added.`,
      diagnosticsExported: (path: string) => `Diagnostics exported to ${path}`
    }
  }
} as const

export function getCopy(locale: Locale) {
  return dictionary[locale]
}

export function localizeCapability(
  kind: 'tools' | 'skills',
  item: ToolItem | SkillItem,
  locale: Locale
) {
  const translation = capabilityTranslations[kind][item.id]
  if (!translation) {
    return item
  }
  return {
    ...item,
    name: translation[locale].name,
    description: translation[locale].description
  }
}

export function getThemeLabel(locale: Locale, theme: 'system' | 'light' | 'dark') {
  const copy = getCopy(locale).onboarding
  if (theme === 'light') {
    return copy.themeLight
  }
  if (theme === 'dark') {
    return copy.themeDark
  }
  return copy.themeSystem
}

export function getUpdateSummary(locale: Locale, state: UpdateState | null) {
  if (!state) {
    return getCopy(locale).common.loadingStatus
  }
  return state.message
}
