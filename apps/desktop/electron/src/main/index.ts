import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import { startAdapterServer } from '@product/adapter'
import { createRuntimeManager } from '@product/runtime-manager'
import { DEFAULT_BRAND, type DesktopEnvironment } from '@product/shared'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFile)

let mainWindow: BrowserWindow | null = null
let environment: DesktopEnvironment | null = null
let shutdownAdapter: (() => Promise<void>) | null = null
const projectRoot = resolve(currentDir, '../../../../')

async function createDesktopEnvironment() {
  app.setName(DEFAULT_BRAND.productName)

  const runtimeManager = await createRuntimeManager({
    brand: DEFAULT_BRAND,
    appVersion: app.getVersion(),
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
    autoUpdateSupported: true,
    basePaths: {
      configRoot: app.getPath('appData'),
      dataRoot: app.getPath('userData'),
      cacheRoot: join(app.getPath('userData'), 'Cache'),
      logsRoot: app.getPath('logs')
    }
  })

  await runtimeManager.start()

  const adapter = await startAdapterServer({
    appVersion: app.getVersion(),
    runtimeManager
  })

  shutdownAdapter = adapter.close

  environment = {
    adapterBaseUrl: adapter.baseUrl,
    productName: DEFAULT_BRAND.productName,
    productVersion: app.getVersion(),
    paths: {
      dataDir: runtimeManager.paths.dataDir,
      logsDir: runtimeManager.paths.logsDir
    }
  }
}

async function createWindow() {
  if (!environment) {
    await createDesktopEnvironment()
  }

  const preloadPath = resolve(currentDir, '../preload/index.js')
  const frontendEntry = resolve(currentDir, '../../../frontend/dist/index.html')

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#eef2e6',
    title: DEFAULT_BRAND.productName,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false
    }
  })

  await mainWindow.loadFile(frontendEntry)
}

ipcMain.handle('desktop:get-environment', async () => environment)
ipcMain.handle('desktop:open-data-directory', async () => {
  if (environment) {
    await shell.openPath(environment.paths.dataDir)
  }
})
ipcMain.handle('desktop:open-logs-directory', async () => {
  if (environment) {
    await shell.openPath(environment.paths.logsDir)
  }
})
ipcMain.handle('desktop:open-open-source-notes', async () => {
  await shell.openPath(resolve(projectRoot, 'THIRD_PARTY_NOTICES.md'))
})

app.whenReady().then(async () => {
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (shutdownAdapter) {
    await shutdownAdapter()
    shutdownAdapter = null
  }
})
