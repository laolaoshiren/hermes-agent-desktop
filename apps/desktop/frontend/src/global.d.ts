import type {
  CompanionCommandResult,
  DesktopEnvironment,
  HermesCompanionCommand,
  HermesRuntimeSnapshot,
  RuntimeCommandResult,
  RuntimeLogTail
} from '@product/shared'

declare global {
  interface Window {
    desktop: {
      getEnvironment(): Promise<DesktopEnvironment>
      getRuntimeSnapshot(): Promise<HermesRuntimeSnapshot>
      startRuntime(): Promise<RuntimeCommandResult>
      stopRuntime(): Promise<RuntimeCommandResult>
      restartRuntime(): Promise<RuntimeCommandResult>
      getLogTail(lineCount?: number): Promise<RuntimeLogTail>
      launchHermesCommand(command: HermesCompanionCommand): Promise<CompanionCommandResult>
      openHermesHome(): Promise<void>
      openLogsDirectory(): Promise<void>
      openOpenSourceNotes(): Promise<void>
    }
  }
}

export {}
