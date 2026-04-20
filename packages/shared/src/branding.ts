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
  productName: process.env.PRODUCT_NAME ?? 'Aurora Desk',
  productShortName: process.env.PRODUCT_SHORT_NAME ?? 'Aurora',
  vendorName: process.env.PRODUCT_VENDOR ?? 'Aurora Labs',
  runtimeDisplayName: process.env.RUNTIME_DISPLAY_NAME ?? 'Aurora Runtime',
  dataDirName: process.env.PRODUCT_DATA_DIR ?? 'AuroraDesk',
  cacheDirName: process.env.PRODUCT_CACHE_DIR ?? 'AuroraDesk',
  logsDirName: process.env.PRODUCT_LOGS_DIR ?? 'AuroraDesk',
  helpCenterName: process.env.PRODUCT_HELP_CENTER ?? '帮助中心',
  stableChannelName: process.env.PRODUCT_STABLE_CHANNEL ?? '稳定版',
  betaChannelName: process.env.PRODUCT_BETA_CHANNEL ?? '测试版'
}
