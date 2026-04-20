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
  productName: process.env.PRODUCT_NAME ?? 'Hermes Control Desk',
  productShortName: process.env.PRODUCT_SHORT_NAME ?? 'Hermes Desk',
  vendorName: process.env.PRODUCT_VENDOR ?? 'Hermes Control Desk OSS',
  runtimeDisplayName: process.env.RUNTIME_DISPLAY_NAME ?? 'Hermes Agent Runtime',
  dataDirName: process.env.PRODUCT_DATA_DIR ?? 'HermesAgentDesktop',
  cacheDirName: process.env.PRODUCT_CACHE_DIR ?? 'HermesAgentDesktop',
  logsDirName: process.env.PRODUCT_LOGS_DIR ?? 'HermesAgentDesktop',
  helpCenterName: process.env.PRODUCT_HELP_CENTER ?? 'Hermes Help Center',
  stableChannelName: process.env.PRODUCT_STABLE_CHANNEL ?? 'Stable',
  betaChannelName: process.env.PRODUCT_BETA_CHANNEL ?? 'Beta'
}
