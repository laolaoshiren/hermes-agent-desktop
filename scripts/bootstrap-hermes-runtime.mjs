import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const runtimeRoot = join(root, 'runtime', 'python')
const downloadsRoot = join(root, '.runtime-downloads')
const getPipScript = join(root, '.runtime-downloads', 'get-pip.py')
const vendoredGatewayStatus = join(root, 'vendor', 'hermes-agent', 'gateway', 'status.py')
const installedGatewayStatus = join(runtimeRoot, 'Lib', 'site-packages', 'gateway', 'status.py')
const windowsEmbeddedPythonVersion = '3.11.9'
const windowsEmbeddedPythonUrl = `https://www.python.org/ftp/python/${windowsEmbeddedPythonVersion}/python-${windowsEmbeddedPythonVersion}-embed-amd64.zip`
const windowsEmbeddedPythonArchive = join(
  downloadsRoot,
  `python-${windowsEmbeddedPythonVersion}-embed-amd64.zip`
)
const pythonExeCandidates = isWindows
  ? [join(runtimeRoot, 'python.exe')]
  : [join(runtimeRoot, 'bin', 'python3')]
const windowsPortablePythonPathFile = join(runtimeRoot, 'python311._pth')
const windowsVenvMarkerFile = join(runtimeRoot, 'pyvenv.cfg')
const windowsVenvPythonExe = join(runtimeRoot, 'Scripts', 'python.exe')

let pythonExe = resolvePythonExecutable()

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

function resolvePythonExecutable() {
  return pythonExeCandidates.find((candidate) => existsSync(candidate)) ?? pythonExeCandidates.at(-1)
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, Buffer.from(arrayBuffer))
}

async function ensureWindowsEmbedPathFile() {
  const pthPath = windowsPortablePythonPathFile
  if (!existsSync(pthPath)) {
    return
  }

  const content = ['python311.zip', '.', 'Lib', 'Lib\\site-packages', '', 'import site', ''].join('\n')
  await writeFile(pthPath, content, 'utf8')
}

function hasPortableWindowsRuntime() {
  return (
    existsSync(join(runtimeRoot, 'python.exe')) &&
    existsSync(windowsPortablePythonPathFile) &&
    !existsSync(windowsVenvMarkerFile) &&
    !existsSync(windowsVenvPythonExe)
  )
}

async function ensurePortableWindowsRuntime() {
  await rm(runtimeRoot, { recursive: true, force: true })

  if (!existsSync(windowsEmbeddedPythonArchive)) {
    await downloadFile(windowsEmbeddedPythonUrl, windowsEmbeddedPythonArchive)
  }

  await mkdir(runtimeRoot, { recursive: true })
  await run('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${windowsEmbeddedPythonArchive.replace(/'/g, "''")}' -DestinationPath '${runtimeRoot.replace(/'/g, "''")}' -Force`
  ])
}

async function ensurePythonRuntime() {
  if (isWindows) {
    if (!hasPortableWindowsRuntime()) {
      try {
        await ensurePortableWindowsRuntime()
      } catch (downloadError) {
        throw new Error(
          [
            'Windows runtime is missing or non-portable and embedded bootstrap failed.',
            `Required runtime: ${windowsEmbeddedPythonUrl}`,
            `download error: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`
          ].join('\n')
        )
      }
    }

    pythonExe = join(runtimeRoot, 'python.exe')
    if (!existsSync(pythonExe)) {
      throw new Error(`Portable Windows Python runtime is still missing: ${pythonExe}`)
    }

    return
  }

  if (!existsSync(resolvePythonExecutable())) {
    await run('python3', ['-m', 'venv', runtimeRoot])
  }

  pythonExe = resolvePythonExecutable()
  if (!existsSync(pythonExe)) {
    throw new Error(`Python runtime bootstrap succeeded but executable is still missing: ${pythonExe}`)
  }
}

async function ensurePip() {
  try {
    await run(pythonExe, ['-m', 'pip', '--version'], { capture: true })
    return
  } catch {
    if (isWindows) {
      if (!existsSync(getPipScript)) {
        await downloadFile('https://bootstrap.pypa.io/get-pip.py', getPipScript)
      }
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
