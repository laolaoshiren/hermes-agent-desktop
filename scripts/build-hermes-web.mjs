import { spawn } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webDir = join(root, 'vendor', 'hermes-agent', 'web')
const uiDist = join(webDir, 'node_modules', '@nous-research', 'ui', 'dist')
const fontsSource = join(uiDist, 'fonts')
const assetsSource = join(uiDist, 'assets')
const fontsTarget = join(webDir, 'public', 'fonts')
const assetsTarget = join(webDir, 'public', 'ds-assets')

function commandName(command) {
  if (process.platform !== 'win32') {
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

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(commandName(command), args, {
      cwd: webDir,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })
    child.once('error', rejectRun)
    child.once('exit', (code) => {
      if (code !== 0) {
        rejectRun(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
        return
      }
      resolveRun()
    })
  })
}

async function syncAssets() {
  await rm(fontsTarget, { recursive: true, force: true })
  await rm(assetsTarget, { recursive: true, force: true })
  await mkdir(join(webDir, 'public'), { recursive: true })
  await cp(fontsSource, fontsTarget, { recursive: true, force: true })
  await cp(assetsSource, assetsTarget, { recursive: true, force: true })
}

async function main() {
  if (!existsSync(webDir)) {
    throw new Error(`Hermes web workspace is missing: ${webDir}`)
  }

  await run('npm', ['install'])
  await syncAssets()
  await run('npx', ['tsc', '-b'])
  await run('npx', ['vite', 'build'])
}

await main()
