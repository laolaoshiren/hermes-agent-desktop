export interface BrandConfig {
  productName: string
  productShortName: string
  vendorName: string
  runtimeDisplayName: string
  dataDirName: string
  cacheDirName: string
  logsDirName: string
  helpCenterName: string
  stableChannelName: string
  betaChannelName: string
}

export const DEFAULT_BRAND: BrandConfig = {
  productName: process.env.PRODUCT_NAME ?? 'Hermes Agent Console',
  productShortName: process.env.PRODUCT_SHORT_NAME ?? 'Hermes Console',
  vendorName: process.env.PRODUCT_VENDOR ?? 'Hermes Agent Console OSS',
  runtimeDisplayName: process.env.RUNTIME_DISPLAY_NAME ?? 'Hermes Agent Sidecar',
  dataDirName: process.env.PRODUCT_DATA_DIR ?? 'HermesAgentConsole',
  cacheDirName: process.env.PRODUCT_CACHE_DIR ?? 'HermesAgentConsole',
  logsDirName: process.env.PRODUCT_LOGS_DIR ?? 'HermesAgentConsole',
  helpCenterName: process.env.PRODUCT_HELP_CENTER ?? 'Hermes 帮助中心',
  stableChannelName: process.env.PRODUCT_STABLE_CHANNEL ?? '稳定版',
  betaChannelName: process.env.PRODUCT_BETA_CHANNEL ?? '测试版'
}
