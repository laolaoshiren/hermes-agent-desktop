import { existsSync } from 'node:fs'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import { createRuntimeManager, type RuntimeManager } from '@product/runtime-manager'
import { DEFAULT_BRAND, type DesktopEnvironment } from '@product/shared'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFile)
const APP_ID = 'com.laolaoshiren.hermesagentdesktop'

let mainWindow: BrowserWindow | null = null
let runtimeManager: RuntimeManager | null = null
const projectRoot = resolve(currentDir, '../../../../')

function resolveWindowIconPath() {
  if (process.platform === 'darwin') {
    return undefined
  }

  const iconPath = resolve(projectRoot, 'build', 'icon.png')
  return existsSync(iconPath) ? iconPath : undefined
}

async function ensureRuntimeManager() {
  if (runtimeManager) {
    return runtimeManager
  }

  app.setName(DEFAULT_BRAND.productName)
  app.setAppUserModelId(APP_ID)

  runtimeManager = await createRuntimeManager({
    brand: DEFAULT_BRAND,
    appVersion: app.getVersion(),
    projectRoot,
    resourcesRoot: process.resourcesPath,
    basePaths: {
      configRoot: app.getPath('appData'),
      dataRoot: app.getPath('userData'),
      cacheRoot: join(app.getPath('userData'), 'Cache'),
      logsRoot: app.getPath('logs')
    }
  })

  return runtimeManager
}

async function toDesktopEnvironment(): Promise<DesktopEnvironment> {
  const manager = await ensureRuntimeManager()
  return {
    productName: DEFAULT_BRAND.productName,
    productVersion: app.getVersion(),
    locale: manager.settings.locale,
    defaultPage: 'chat',
    settings: manager.settings,
    runtime: manager.getSnapshot()
  }
}

async function createWindow() {
  await ensureRuntimeManager()

  const preloadPath = resolve(currentDir, '../preload/index.js')
  const frontendEntry = resolve(currentDir, '../../../frontend/dist/index.html')
  const windowIcon = resolveWindowIconPath()

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#08131d',
    title: DEFAULT_BRAND.productName,
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false
    }
  })

  await mainWindow.loadFile(frontendEntry)
}

ipcMain.handle('desktop:get-environment', async () => toDesktopEnvironment())
ipcMain.handle('desktop:get-runtime-snapshot', async () => {
  const manager = await ensureRuntimeManager()
  return manager.getSnapshot()
})
ipcMain.handle('desktop:start-runtime', async () => {
  const manager = await ensureRuntimeManager()
  return { snapshot: await manager.start() }
})
ipcMain.handle('desktop:stop-runtime', async () => {
  const manager = await ensureRuntimeManager()
  return { snapshot: await manager.stop() }
})
ipcMain.handle('desktop:restart-runtime', async () => {
  const manager = await ensureRuntimeManager()
  return { snapshot: await manager.restart() }
})
ipcMain.handle('desktop:get-log-tail', async (_event, lineCount?: number) => {
  const manager = await ensureRuntimeManager()
  return manager.getLogTail(lineCount)
})
ipcMain.handle('desktop:launch-hermes-command', async (_event, command) => {
  const manager = await ensureRuntimeManager()
  await manager.launchCompanionCommand(command)
  return { command }
})
ipcMain.handle('desktop:open-hermes-home', async () => {
  const manager = await ensureRuntimeManager()
  await shell.openPath(manager.paths.hermesHome)
})
ipcMain.handle('desktop:open-logs-directory', async () => {
  const manager = await ensureRuntimeManager()
  await shell.openPath(manager.paths.logsDir)
})
ipcMain.handle('desktop:open-open-source-notes', async () => {
  await shell.openPath(resolve(projectRoot, 'THIRD_PARTY_NOTICES.md'))
})

app.whenReady().then(async () => {
  await ensureRuntimeManager()
  const manager = runtimeManager
  if (manager) {
    void manager.start().catch(() => undefined)
  }

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
  if (runtimeManager) {
    await runtimeManager.stop()
  }
})
