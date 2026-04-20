import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  getEnvironment: () => ipcRenderer.invoke('desktop:get-environment'),
  openDataDirectory: () => ipcRenderer.invoke('desktop:open-data-directory'),
  openLogsDirectory: () => ipcRenderer.invoke('desktop:open-logs-directory'),
  openOpenSourceNotes: () => ipcRenderer.invoke('desktop:open-open-source-notes')
})
