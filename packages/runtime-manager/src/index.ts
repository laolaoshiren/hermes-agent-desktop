import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { AppPaths, BrandConfig, CapabilityFlags, RuntimeStatus } from '@product/shared'

export interface RuntimeManagerOptions {
  brand: BrandConfig
  appVersion: string
  secureStorageAvailable: boolean
  autoUpdateSupported: boolean
  basePaths?: {
    configRoot: string
    dataRoot: string
    cacheRoot: string
    logsRoot: string
  }
}

export interface RuntimeManager {
  appVersion: string
  runtimeVersion: string
  upstreamHermesVersion: string
  status: RuntimeStatus
  paths: AppPaths
  capabilities: CapabilityFlags
  start(): Promise<void>
  getStatus(): RuntimeStatus
}

export function createAppPaths(
  brand: BrandConfig,
  basePaths: RuntimeManagerOptions['basePaths'] = {
    configRoot: join(process.cwd(), '.product-data', 'config'),
    dataRoot: join(process.cwd(), '.product-data', 'data'),
    cacheRoot: join(process.cwd(), '.product-data', 'cache'),
    logsRoot: join(process.cwd(), '.product-data', 'logs')
  }
): AppPaths {
  return {
    configDir: join(basePaths.configRoot, brand.dataDirName),
    dataDir: join(basePaths.dataRoot, brand.dataDirName),
    cacheDir: join(basePaths.cacheRoot, brand.cacheDirName),
    logsDir: join(basePaths.logsRoot, brand.logsDirName),
    updatesDir: join(basePaths.dataRoot, brand.dataDirName, 'Updates'),
    exportsDir: join(basePaths.dataRoot, brand.dataDirName, 'exports'),
    attachmentsDir: join(basePaths.dataRoot, brand.dataDirName, 'attachments'),
    brand
  }
}

export function detectCapabilities(options: RuntimeManagerOptions): CapabilityFlags {
  return {
    supportsNativeShellTooling: process.platform !== 'win32',
    supportsPtyFull: process.platform !== 'win32',
    supportsSecureStorage: options.secureStorageAvailable,
    supportsAutoUpdate: options.autoUpdateSupported,
    supportsImagePaste: false,
    supportsDragDropAttachments: true
  }
}

export async function createRuntimeManager(options: RuntimeManagerOptions): Promise<RuntimeManager> {
  const paths = createAppPaths(options.brand, options.basePaths)
  const capabilities = detectCapabilities(options)

  async function ensureDirectories() {
    await Promise.all(
      [
        paths.configDir,
        paths.dataDir,
        paths.cacheDir,
        paths.logsDir,
        paths.updatesDir,
        paths.exportsDir,
        paths.attachmentsDir
      ].map((path) => mkdir(path, { recursive: true }))
    )
  }

  const manager: RuntimeManager = {
    appVersion: options.appVersion,
    runtimeVersion: '0.1.0',
    upstreamHermesVersion: '0.10.0-vendored',
    status: 'starting',
    paths,
    capabilities,
    async start() {
      await ensureDirectories()
      manager.status = 'ready'
    },
    getStatus() {
      return manager.status
    }
  }

  return manager
}
