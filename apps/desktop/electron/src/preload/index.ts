import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  getEnvironment: () => ipcRenderer.invoke('desktop:get-environment'),
  getRuntimeSnapshot: () => ipcRenderer.invoke('desktop:get-runtime-snapshot'),
  startRuntime: () => ipcRenderer.invoke('desktop:start-runtime'),
  stopRuntime: () => ipcRenderer.invoke('desktop:stop-runtime'),
  restartRuntime: () => ipcRenderer.invoke('desktop:restart-runtime'),
  getLogTail: (lineCount?: number) => ipcRenderer.invoke('desktop:get-log-tail', lineCount),
  launchHermesCommand: (command: string) => ipcRenderer.invoke('desktop:launch-hermes-command', command),
  openHermesHome: () => ipcRenderer.invoke('desktop:open-hermes-home'),
  openLogsDirectory: () => ipcRenderer.invoke('desktop:open-logs-directory'),
  openOpenSourceNotes: () => ipcRenderer.invoke('desktop:open-open-source-notes')
})
