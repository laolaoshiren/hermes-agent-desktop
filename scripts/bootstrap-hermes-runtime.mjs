import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const runtimeRoot = join(root, 'runtime', 'python')
const pythonExe = isWindows ? join(runtimeRoot, 'python.exe') : join(runtimeRoot, 'bin', 'python3')
const getPipScript = join(root, '.runtime-downloads', 'get-pip.py')
const vendoredGatewayStatus = join(root, 'vendor', 'hermes-agent', 'gateway', 'status.py')
const installedGatewayStatus = join(runtimeRoot, 'Lib', 'site-packages', 'gateway', 'status.py')

function commandName(command) {
  if (!isWindows) {
    return command
  }
  if (command === 'npm') {
    return 'npm.cmd'
  }
  if (command === 'npx') {
    return 'npx.cmd'
  }
  return command
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(commandName(command), args, {
      cwd: options.cwd ?? root,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    })

    const stdout = []
    const stderr = []
    if (options.capture) {
      child.stdout?.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
      child.stderr?.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    }

    child.once('error', rejectRun)
    child.once('exit', (code) => {
      if (code !== 0) {
        rejectRun(
          new Error(
            options.capture
              ? Buffer.concat(stderr).toString('utf8').trim() || `${command} ${args.join(' ')} failed`
              : `${command} ${args.join(' ')} failed with exit code ${code}`
          )
        )
        return
      }

      resolveRun({
        stdout: options.capture ? Buffer.concat(stdout).toString('utf8') : '',
        stderr: options.capture ? Buffer.concat(stderr).toString('utf8') : ''
      })
    })
  })
}

async function ensureWindowsEmbedPathFile() {
  const pthPath = join(runtimeRoot, 'python311._pth')
  if (!existsSync(pthPath)) {
    return
  }

  const content = ['python311.zip', '.', 'Lib', 'Lib\\site-packages', '', 'import site', ''].join('\n')
  await writeFile(pthPath, content, 'utf8')
}

async function ensurePythonRuntime() {
  if (existsSync(pythonExe)) {
    return
  }

  if (isWindows) {
    throw new Error(`Bundled Windows runtime is missing: ${pythonExe}`)
  }

  await run('python3', ['-m', 'venv', runtimeRoot])
}

async function ensurePip() {
  try {
    await run(pythonExe, ['-m', 'pip', '--version'], { capture: true })
    return
  } catch {
    if (isWindows) {
      await run(pythonExe, [getPipScript])
      return
    }

    await run(pythonExe, ['-m', 'ensurepip', '--upgrade'])
  }
}

async function dependencyProbe() {
  const script = [
    'import importlib.util, json',
    "mods = ['hermes_cli', 'gateway', 'fastapi', 'uvicorn', 'aiohttp', 'yaml', 'pydantic']",
    "print(json.dumps({name: bool(importlib.util.find_spec(name)) for name in mods}))"
  ].join('\n')
  const result = await run(pythonExe, ['-c', script], { capture: true })
  return JSON.parse(result.stdout)
}

async function installHermesDependencies() {
  await run(pythonExe, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'])
  await run(pythonExe, [
    '-m',
    'pip',
    'install',
    join(root, 'vendor', 'hermes-agent') + '[web,cron,pty]',
    'aiohttp>=3.13.3,<4'
  ])
}

async function patchInstalledGatewayStatus() {
  if (!existsSync(vendoredGatewayStatus) || !existsSync(installedGatewayStatus)) {
    return
  }

  const patched = await readFile(vendoredGatewayStatus, 'utf8')
  await mkdir(dirname(installedGatewayStatus), { recursive: true })
  await writeFile(installedGatewayStatus, patched, 'utf8')
}

async function main() {
  await ensurePythonRuntime()

  if (isWindows) {
    await ensureWindowsEmbedPathFile()
  }

  await ensurePip()

  const initial = await dependencyProbe()
  const missing = Object.entries(initial)
    .filter(([, ready]) => !ready)
    .map(([name]) => name)

  if (missing.length > 0) {
    console.log(`Installing Hermes runtime dependencies: ${missing.join(', ')}`)
    await installHermesDependencies()
    await patchInstalledGatewayStatus()
  } else {
    await patchInstalledGatewayStatus()
    console.log('Hermes runtime dependencies already prepared.')
  }
}

await main()
