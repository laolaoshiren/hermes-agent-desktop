export type AppErrorCode =
  | 'APP_UNKNOWN'
  | 'APP_REQUEST_INVALID'
  | 'CFG_PROVIDER_MISSING_API_KEY'
  | 'CFG_PROVIDER_MISSING_MODEL'
  | 'CFG_PROVIDER_MISSING_TYPE'
  | 'CFG_PROVIDER_INVALID_BASE_URL'
  | 'RT_START_FAILED'
  | 'RT_SESSION_NOT_FOUND'
  | 'UPD_DOWNLOAD_FAILED'
  | 'ATT_FILE_TOO_LARGE'
  | 'ATT_INVALID_PAYLOAD'
  | 'NET_REQUEST_FAILED'

export interface AppError {
  code: AppErrorCode
  message: string
  retryable: boolean
  openSettingsSuggested: boolean
  allowDiagnosticsExport: boolean
  details?: string
}

export const APP_ERRORS: Record<AppErrorCode, Omit<AppError, 'details'>> = {
  APP_UNKNOWN: {
    code: 'APP_UNKNOWN',
    message: '发生了未预期的问题，请稍后重试。',
    retryable: true,
    openSettingsSuggested: false,
    allowDiagnosticsExport: true
  },
  APP_REQUEST_INVALID: {
    code: 'APP_REQUEST_INVALID',
    message: '当前请求缺少必要信息，请检查后重试。',
    retryable: false,
    openSettingsSuggested: false,
    allowDiagnosticsExport: false
  },
  CFG_PROVIDER_MISSING_API_KEY: {
    code: 'CFG_PROVIDER_MISSING_API_KEY',
    message: '模型连接缺少 API Key，请先完成模型配置。',
    retryable: false,
    openSettingsSuggested: true,
    allowDiagnosticsExport: false
  },
  CFG_PROVIDER_MISSING_MODEL: {
    code: 'CFG_PROVIDER_MISSING_MODEL',
    message: '模型名称为空，请先完成模型配置。',
    retryable: false,
    openSettingsSuggested: true,
    allowDiagnosticsExport: false
  },
  CFG_PROVIDER_MISSING_TYPE: {
    code: 'CFG_PROVIDER_MISSING_TYPE',
    message: '请先选择模型服务商类型。',
    retryable: false,
    openSettingsSuggested: true,
    allowDiagnosticsExport: false
  },
  CFG_PROVIDER_INVALID_BASE_URL: {
    code: 'CFG_PROVIDER_INVALID_BASE_URL',
    message: 'Base URL 格式无效，请检查输入后重试。',
    retryable: false,
    openSettingsSuggested: true,
    allowDiagnosticsExport: false
  },
  RT_START_FAILED: {
    code: 'RT_START_FAILED',
    message: '本地服务启动失败，正在尝试恢复。',
    retryable: true,
    openSettingsSuggested: false,
    allowDiagnosticsExport: true
  },
  RT_SESSION_NOT_FOUND: {
    code: 'RT_SESSION_NOT_FOUND',
    message: '找不到这条会话，请刷新列表后重试。',
    retryable: false,
    openSettingsSuggested: false,
    allowDiagnosticsExport: false
  },
  UPD_DOWNLOAD_FAILED: {
    code: 'UPD_DOWNLOAD_FAILED',
    message: '更新下载失败，请稍后重新检查更新。',
    retryable: true,
    openSettingsSuggested: false,
    allowDiagnosticsExport: true
  },
  ATT_FILE_TOO_LARGE: {
    code: 'ATT_FILE_TOO_LARGE',
    message: '附件过大，请选择更小的文件。',
    retryable: false,
    openSettingsSuggested: false,
    allowDiagnosticsExport: false
  },
  ATT_INVALID_PAYLOAD: {
    code: 'ATT_INVALID_PAYLOAD',
    message: '附件内容无法识别，请重新选择文件。',
    retryable: true,
    openSettingsSuggested: false,
    allowDiagnosticsExport: false
  },
  NET_REQUEST_FAILED: {
    code: 'NET_REQUEST_FAILED',
    message: '网络请求失败，请检查网络或稍后重试。',
    retryable: true,
    openSettingsSuggested: false,
    allowDiagnosticsExport: true
  }
}

export function createAppError(code: AppErrorCode, details?: string): AppError {
  if (details) {
    return {
      ...APP_ERRORS[code],
      details
    }
  }

  return {
    ...APP_ERRORS[code]
  }
}
