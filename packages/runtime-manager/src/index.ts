import { randomBytes } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, join, resolve, delimiter } from 'node:path'
import { get } from 'node:http'

import type {
  AppPaths,
  BrandConfig,
  DesktopSettings,
  HermesCompanionCommand,
  HermesRuntimeSnapshot,
  PythonRuntimeSnapshot,
  RuntimeDependencyStatus,
  RuntimeServiceSnapshot,
  RuntimeStatus
} from '@product/shared'

const UPSTREAM_HERMES_VERSION = '0.10.0-vendored'
const DEFAULT_SETTINGS: DesktopSettings = {
  locale: 'zh-CN',
  theme: 'system',
  launchOnStartup: true,
  openDashboardOnLaunch: false
}

interface ResolvedRuntimeLayout {
  pythonExecutable: string
  pythonRoot: string
  pythonPathFile: string | null
  sitePackagesDir: string
  hermesRoot: string
  hermesWebDist: string | null
}

interface ProcessRecord {
  process: ChildProcess | null
  logFile: string
  output: WriteStream | null
}

interface PythonProbeResult {
  version: string | null
  dependencies: RuntimeDependencyStatus
}

export interface RuntimeManagerOptions {
  brand: BrandConfig
  appVersion: string
  projectRoot?: string
  resourcesRoot?: string
  basePaths?: {
    configRoot: string
    dataRoot: string
    cacheRoot: string
    logsRoot: string
  }
}

export interface RuntimeManager {
  appVersion: string
  upstreamHermesVersion: string
  paths: AppPaths
  settings: DesktopSettings
  start(): Promise<HermesRuntimeSnapshot>
  stop(): Promise<HermesRuntimeSnapshot>
  restart(): Promise<HermesRuntimeSnapshot>
  getSnapshot(): HermesRuntimeSnapshot
  getLogTail(lineCount?: number): Promise<{ dashboard: string[]; gateway: string[] }>
  launchCompanionCommand(command: HermesCompanionCommand): Promise<void>
}

const COMPANION_COMMANDS: Record<
  HermesCompanionCommand,
  {
    args: string[]
  }
> = {
  'chat-tui': {
    args: ['chat', '--tui']
  },
  sessions: {
    args: ['sessions', 'list']
  },
  model: {
    args: ['model']
  },
  tools: {
    args: ['tools']
  },
  auth: {
    args: ['auth']
  },
  profile: {
    args: ['profile']
  },
  'gateway-setup': {
    args: ['gateway', 'setup']
  }
}

function createEmptyService(): RuntimeServiceSnapshot {
  return {
    status: 'stopped',
    port: null,
    url: null,
    pid: null,
    startedAt: null,
    lastError: null,
    lastExitCode: null
  }
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
  const dataDir = join(basePaths.dataRoot, brand.dataDirName)

  return {
    configDir: join(basePaths.configRoot, brand.dataDirName),
    dataDir,
    cacheDir: join(basePaths.cacheRoot, brand.cacheDirName),
    logsDir: join(basePaths.logsRoot, brand.logsDirName),
    updatesDir: join(dataDir, 'updates'),
    exportsDir: join(dataDir, 'exports'),
    attachmentsDir: join(dataDir, 'attachments'),
    hermesHome: join(dataDir, 'hermes-home'),
    brand
  }
}

function fileExists(path: string | null | undefined) {
  return typeof path === 'string' && existsSync(path)
}

function uniquePaths(values: string[]) {
  return [...new Set(values)]
}

function resolveRuntimeLayout(options: RuntimeManagerOptions): ResolvedRuntimeLayout {
  const cwd = process.cwd()
  const roots = uniquePaths(
    [options.projectRoot, options.resourcesRoot, cwd]
      .filter((value): value is string => Boolean(value))
      .flatMap((root) => [root, join(root, 'app.asar.unpacked')])
  )

  const pythonExecutable =
    roots
      .flatMap((root) =>
        process.platform === 'win32'
          ? [join(root, 'runtime', 'python', 'python.exe'), join(root, 'runtime', 'python', 'Scripts', 'python.exe')]
          : [join(root, 'runtime', 'python', 'bin', 'python3')]
      )
      .find(fileExists) ?? join(cwd, 'runtime', 'python', 'python.exe')

  const pythonExecutableDir = dirname(pythonExecutable)
  const pythonRoot =
    process.platform === 'win32' &&
    pythonExecutableDir.toLowerCase().endsWith('\\scripts')
      ? resolve(pythonExecutableDir, '..')
      : pythonExecutableDir
  const sitePackagesDir =
    process.platform === 'win32'
      ? join(pythonRoot, 'Lib', 'site-packages')
      : join(pythonRoot, 'lib', 'python3.11', 'site-packages')

  const hermesRoot =
    roots.map((root) => join(root, 'vendor', 'hermes-agent')).find(fileExists) ??
    join(cwd, 'vendor', 'hermes-agent')

  const hermesWebDist =
    roots
      .map((root) => join(root, 'vendor', 'hermes-agent', 'hermes_cli', 'web_dist'))
      .find(fileExists) ?? null

  const pythonPathFile = fileExists(join(pythonRoot, 'python311._pth'))
    ? join(pythonRoot, 'python311._pth')
    : null

  return {
    pythonExecutable,
    pythonRoot,
    pythonPathFile,
    sitePackagesDir,
    hermesRoot,
    hermesWebDist,
  }
}

async function ensureDirectories(paths: AppPaths, runtimeLayout: ResolvedRuntimeLayout) {
  await Promise.all(
    [
      paths.configDir,
      paths.dataDir,
      paths.cacheDir,
      paths.logsDir,
      paths.updatesDir,
      paths.exportsDir,
      paths.attachmentsDir,
      paths.hermesHome,
      runtimeLayout.sitePackagesDir
    ].map((path) => mkdir(path, { recursive: true }))
  )
}

async function reservePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to reserve a local port.'))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolvePort(port)
      })
    })
  })
}

function httpGetJson(url: string): Promise<{ ok: boolean; statusCode: number; body: string }> {
  return new Promise((resolveRequest, reject) => {
    const request = get(
      url,
      {
        timeout: 3_000
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          resolveRequest({
            ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
            statusCode: response.statusCode ?? 500,
            body: Buffer.concat(chunks).toString('utf8')
          })
        })
      }
    )

    request.on('timeout', () => {
      request.destroy(new Error(`Timed out while requesting ${url}`))
    })
    request.on('error', reject)
  })
}

async function waitForService(url: string, timeoutMs: number) {
  const startedAt = Date.now()
  let lastError: string | null = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await httpGetJson(url)
      if (result.ok) {
        return
      }
      lastError = `HTTP ${result.statusCode}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }

  throw new Error(lastError ?? `Service did not become ready: ${url}`)
}

function createSnapshot(
  appVersion: string,
  paths: AppPaths,
  python: PythonRuntimeSnapshot,
  overallStatus: RuntimeStatus,
  dashboard: RuntimeServiceSnapshot,
  api: RuntimeServiceSnapshot & { apiKey: string | null },
  lastError: string | null
): HermesRuntimeSnapshot {
  return {
    overallStatus,
    appVersion,
    upstreamHermesVersion: UPSTREAM_HERMES_VERSION,
    lastError,
    paths: {
      hermesHome: paths.hermesHome,
      dataDir: paths.dataDir,
      logsDir: paths.logsDir,
      configDir: paths.configDir
    },
    python,
    dashboard,
    api
  }
}

async function probePythonRuntime(runtimeLayout: ResolvedRuntimeLayout): Promise<PythonProbeResult> {
  const script = [
    'import importlib.util, json, sys',
    "mods = ['fastapi', 'uvicorn', 'aiohttp', 'yaml', 'pydantic']",
    'print(json.dumps({',
    "  'version': sys.version.split()[0],",
    "  'dependencies': {name: bool(importlib.util.find_spec(name)) for name in mods}",
    '}))'
  ].join('\n')

  return new Promise((resolveProbe, reject) => {
    const child = spawn(runtimeLayout.pythonExecutable, ['-c', script], {
      cwd: runtimeLayout.hermesRoot,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: [runtimeLayout.hermesRoot, runtimeLayout.sitePackagesDir].join(delimiter)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout?.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr?.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            Buffer.concat(stderr).toString('utf8').trim() || `Python probe exited with code ${code}`
          )
        )
        return
      }

      try {
        const payload = JSON.parse(Buffer.concat(stdout).toString('utf8')) as PythonProbeResult
        resolveProbe(payload)
      } catch (error) {
        reject(error)
      }
    })
  })
}

async function readLogTail(path: string, lineCount: number) {
  if (!fileExists(path)) {
    return [] as string[]
  }

  const content = await readFile(path, 'utf8')
  return content.split(/\r?\n/).filter(Boolean).slice(-lineCount)
}

async function terminateProcess(child: ChildProcess | null) {
  if (!child || child.exitCode !== null) {
    return
  }

  const waitForExit = (timeoutMs: number) =>
    new Promise<boolean>((resolveExit) => {
      const timer = setTimeout(() => {
        child.off('exit', handleExit)
        resolveExit(false)
      }, timeoutMs)

      const handleExit = () => {
        clearTimeout(timer)
        resolveExit(true)
      }

      child.once('exit', handleExit)
    })

  child.kill()
  const exitedGracefully = await waitForExit(4_000)
  if (exitedGracefully || !child.pid) {
    return
  }

  if (process.platform === 'win32') {
    await new Promise<void>((resolveTaskkill) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore'
      })
      killer.once('exit', () => resolveTaskkill())
      killer.once('error', () => resolveTaskkill())
    })
    await waitForExit(4_000)
    return
  }

  child.kill('SIGKILL')
  await waitForExit(4_000)
}

async function closeLogStream(record: ProcessRecord) {
  const output = record.output
  if (!output) {
    return
  }

  record.output = null

  if (output.closed || output.destroyed) {
    return
  }

  await new Promise<void>((resolveClose) => {
    const handleClose = () => {
      output.off('error', handleClose)
      resolveClose()
    }

    output.once('close', handleClose)
    output.once('error', handleClose)
    output.end()
  })
}

export async function createRuntimeManager(options: RuntimeManagerOptions): Promise<RuntimeManager> {
  const paths = createAppPaths(options.brand, options.basePaths)
  const runtimeLayout = resolveRuntimeLayout(options)
  const dashboardProcess: ProcessRecord = {
    process: null,
    logFile: join(paths.logsDir, 'dashboard.log'),
    output: null
  }
  const gatewayProcess: ProcessRecord = {
    process: null,
    logFile: join(paths.logsDir, 'gateway.log'),
    output: null
  }

  let dashboardState = createEmptyService()
  let apiState: RuntimeServiceSnapshot & { apiKey: string | null } = {
    ...createEmptyService(),
    apiKey: null
  }
  let overallStatus: RuntimeStatus = 'stopped'
  let lastError: string | null = null
  let pythonState: PythonRuntimeSnapshot = {
    executable: runtimeLayout.pythonExecutable,
    version: null,
    sitePackagesDir: runtimeLayout.sitePackagesDir,
    bootstrapState: 'missing-deps',
    dependencies: {
      fastapi: false,
      uvicorn: false,
      aiohttp: false,
      yaml: false,
      pydantic: false
    }
  }

  function updateOverallStatus() {
    if (dashboardState.status === 'ready' && apiState.status === 'ready') {
      overallStatus = 'ready'
      return
    }
    if (dashboardState.status === 'starting' || apiState.status === 'starting') {
      overallStatus = 'starting'
      return
    }
    if (lastError) {
      overallStatus = 'failed'
      return
    }
    if (dashboardState.status === 'failed' || apiState.status === 'failed') {
      overallStatus = 'degraded'
      return
    }
    overallStatus = 'stopped'
  }

  function getSnapshot() {
    updateOverallStatus()
    return createSnapshot(
      options.appVersion,
      paths,
      pythonState,
      overallStatus,
      dashboardState,
      apiState,
      lastError
    )
  }

  async function refreshPythonState() {
    const probe = await probePythonRuntime(runtimeLayout)
    const dependencyValues = Object.values(probe.dependencies)

    pythonState = {
      executable: runtimeLayout.pythonExecutable,
      version: probe.version,
      sitePackagesDir: runtimeLayout.sitePackagesDir,
      bootstrapState: dependencyValues.every(Boolean) ? 'ready' : 'missing-deps',
      dependencies: probe.dependencies
    }
  }

  function wireProcessLifecycle(record: ProcessRecord, service: 'dashboard' | 'api') {
    const child = record.process
    if (!child) {
      return
    }

    child.once('exit', (code) => {
      if (record.process === child) {
        record.process = null
      }

      const nextError =
        code && code !== 0
          ? `${service === 'dashboard' ? 'Hermes Dashboard' : 'Hermes Gateway'} exited with code ${code}.`
          : null

      if (service === 'dashboard') {
        dashboardState = {
          ...dashboardState,
          status: code === 0 ? 'stopped' : 'failed',
          pid: null,
          lastExitCode: code,
          lastError: nextError
        }
      } else {
        apiState = {
          ...apiState,
          status: code === 0 ? 'stopped' : 'failed',
          pid: null,
          lastExitCode: code,
          lastError: nextError
        }
      }

      if (nextError) {
        lastError = nextError
      }
      updateOverallStatus()
    })

    child.once('close', () => {
      void closeLogStream(record)
    })
  }

  function buildBaseEnvironment(extra: Record<string, string>) {
    const pythonPath = [runtimeLayout.hermesRoot, runtimeLayout.sitePackagesDir]
      .filter(Boolean)
      .join(delimiter)

    return {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1',
      HERMES_HOME: paths.hermesHome,
      PYTHONPATH: pythonPath,
      ...extra
    }
  }

  function buildHermesBootstrapScript(cliArgs: string[]) {
    const escapedPaths = [runtimeLayout.hermesRoot, runtimeLayout.sitePackagesDir]
      .filter(Boolean)
      .map((entry) => JSON.stringify(entry))
      .join(', ')
    const escapedArgs = cliArgs.map((entry) => JSON.stringify(entry)).join(', ')

    return [
      'import sys',
      `sys.path[:0] = [${escapedPaths}]`,
      `sys.argv = ['hermes', ${escapedArgs}]`,
      'from hermes_cli.main import main',
      'main()'
    ].join('\n')
  }

  function buildHermesInlinePython(cliArgs: string[]) {
    const encodedScript = Buffer.from(buildHermesBootstrapScript(cliArgs), 'utf8').toString('base64')
    return `import base64; exec(base64.b64decode('${encodedScript}').decode('utf-8'))`
  }

  function launchWindowsCompanion(cliArgs: string[]) {
    const inlinePython = buildHermesInlinePython(cliArgs)
    const launcher = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Start-Process -FilePath $env:HERMES_PYTHON -WorkingDirectory $env:HERMES_CWD -ArgumentList $env:HERMES_BOOTSTRAP_ARG'
      ],
      {
        cwd: runtimeLayout.hermesRoot,
        env: {
          ...buildBaseEnvironment({}),
          HERMES_PYTHON: runtimeLayout.pythonExecutable,
          HERMES_CWD: runtimeLayout.hermesRoot,
          HERMES_BOOTSTRAP_ARG: `-c "${inlinePython}"`
        },
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }
    )

    launcher.unref()
  }

  function spawnService(record: ProcessRecord, cliArgs: string[], env: Record<string, string>) {
    void closeLogStream(record)

    const output = createWriteStream(record.logFile, { flags: 'a' })
    const child = spawn(runtimeLayout.pythonExecutable, ['-c', buildHermesBootstrapScript(cliArgs)], {
      cwd: runtimeLayout.hermesRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform === 'win32',
      windowsHide: true
    })

    child.stdout?.pipe(output, { end: false })
    child.stderr?.pipe(output, { end: false })
    record.process = child
    record.output = output

    return child
  }

  async function start() {
    if (overallStatus === 'ready') {
      return getSnapshot()
    }

    await ensureDirectories(paths, runtimeLayout)
    await refreshPythonState()

    const missingDependencies = Object.entries(pythonState.dependencies)
      .filter(([, installed]) => !installed)
      .map(([name]) => name)

    if (missingDependencies.length > 0) {
      lastError =
        `Hermes 运行时缺少依赖：${missingDependencies.join(', ')}。` +
        ` 请先把 Hermes Python 依赖安装到 ${runtimeLayout.sitePackagesDir}。`
      dashboardState = { ...createEmptyService(), status: 'failed', lastError }
      apiState = { ...createEmptyService(), apiKey: null, status: 'failed', lastError }
      updateOverallStatus()
      throw new Error(lastError)
    }

    lastError = null
    dashboardState = { ...createEmptyService(), status: 'starting' }
    apiState = { ...createEmptyService(), apiKey: null, status: 'starting' }
    updateOverallStatus()

    const dashboardPort = await reservePort()
    const apiPort = await reservePort()
    const apiKey = randomBytes(24).toString('hex')

    const dashboardUrl = `http://127.0.0.1:${dashboardPort}`
    const apiUrl = `http://127.0.0.1:${apiPort}`

    const sharedEnv = buildBaseEnvironment({
      API_SERVER_ENABLED: '1',
      API_SERVER_HOST: '127.0.0.1',
      API_SERVER_PORT: String(apiPort),
      API_SERVER_KEY: apiKey,
      API_SERVER_CORS_ORIGINS: 'null',
      GATEWAY_HEALTH_URL: apiUrl
    })

    const dashboardEnv = runtimeLayout.hermesWebDist
      ? {
          ...sharedEnv,
          HERMES_WEB_DIST: runtimeLayout.hermesWebDist
        }
      : sharedEnv

    spawnService(
      dashboardProcess,
      ['dashboard', '--host', '127.0.0.1', '--port', String(dashboardPort), '--no-open'],
      dashboardEnv
    )
    dashboardState = {
      status: 'starting',
      port: dashboardPort,
      url: dashboardUrl,
      pid: dashboardProcess.process?.pid ?? null,
      startedAt: new Date().toISOString(),
      lastError: null,
      lastExitCode: null
    }
    wireProcessLifecycle(dashboardProcess, 'dashboard')

    spawnService(
      gatewayProcess,
      ['gateway', 'run', '--quiet'],
      sharedEnv
    )
    apiState = {
      status: 'starting',
      port: apiPort,
      url: apiUrl,
      pid: gatewayProcess.process?.pid ?? null,
      startedAt: new Date().toISOString(),
      lastError: null,
      lastExitCode: null,
      apiKey
    }
    wireProcessLifecycle(gatewayProcess, 'api')

    try {
      await Promise.all([
        waitForService(`${dashboardUrl}/api/status`, 45_000),
        waitForService(`${apiUrl}/health`, 45_000)
      ])
      dashboardState = { ...dashboardState, status: 'ready' }
      apiState = { ...apiState, status: 'ready' }
      updateOverallStatus()
      return getSnapshot()
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      dashboardState = { ...dashboardState, status: 'failed', lastError }
      apiState = { ...apiState, status: 'failed', lastError }
      await stop()
      throw error
    }
  }

  async function stop() {
    await Promise.all([terminateProcess(dashboardProcess.process), terminateProcess(gatewayProcess.process)])
    await Promise.all([closeLogStream(dashboardProcess), closeLogStream(gatewayProcess)])
    dashboardProcess.process = null
    gatewayProcess.process = null
    dashboardState = { ...createEmptyService(), lastError: dashboardState.lastError }
    apiState = { ...createEmptyService(), apiKey: null, lastError: apiState.lastError }
    if (!lastError) {
      overallStatus = 'stopped'
    } else {
      updateOverallStatus()
    }
    return getSnapshot()
  }

  async function restart() {
    await stop()
    lastError = null
    return start()
  }

  async function launchCompanionCommand(command: HermesCompanionCommand) {
    const companion = COMPANION_COMMANDS[command]
    if (!companion) {
      throw new Error(`Unknown Hermes companion command: ${command}`)
    }

    if (process.platform !== 'win32') {
      throw new Error('Hermes CLI/TUI bridge is currently verified on Windows builds only.')
    }

    await ensureDirectories(paths, runtimeLayout)
    launchWindowsCompanion(companion.args)
  }

  return {
    appVersion: options.appVersion,
    upstreamHermesVersion: UPSTREAM_HERMES_VERSION,
    paths,
    settings: DEFAULT_SETTINGS,
    start,
    stop,
    restart,
    launchCompanionCommand,
    getSnapshot,
    async getLogTail(lineCount = 120) {
      return {
        dashboard: await readLogTail(dashboardProcess.logFile, lineCount),
        gateway: await readLogTail(gatewayProcess.logFile, lineCount)
      }
    }
  }
}
