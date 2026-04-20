import type { DesktopEnvironment } from '@product/shared'

declare global {
  interface Window {
    desktop: {
      getEnvironment(): Promise<DesktopEnvironment>
      openDataDirectory(): Promise<void>
      openLogsDirectory(): Promise<void>
      openOpenSourceNotes(): Promise<void>
    }
  }
}

export {}
