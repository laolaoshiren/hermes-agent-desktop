import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { get } from 'node:http'

import { createRuntimeManager } from '../packages/runtime-manager/dist/index.js'
import { DEFAULT_BRAND } from '../packages/shared/dist/index.js'

function request(url) {
  return new Promise((resolve, reject) => {
    const req = get(url, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode ?? 500,
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
    })
    req.on('error', reject)
  })
}

async function requestWithRetry(url, attempts = 5) {
  let lastError = null

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await request(url)
    } catch (error) {
      lastError = error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function main() {
  const testRoot = await mkdtemp(join(tmpdir(), 'hermes-console-smoke-'))
  const manager = await createRuntimeManager({
    brand: DEFAULT_BRAND,
    appVersion: '0.1.0-test',
    projectRoot: process.cwd(),
    resourcesRoot: process.cwd(),
    basePaths: {
      configRoot: join(testRoot, 'config'),
      dataRoot: join(testRoot, 'data'),
      cacheRoot: join(testRoot, 'cache'),
      logsRoot: join(testRoot, 'logs')
    }
  })

  try {
    const snapshot = await manager.start()
    const dashboard = await requestWithRetry(`${snapshot.dashboard.url}/api/status`)
    const api = await requestWithRetry(`${snapshot.api.url}/health`)

    if (dashboard.statusCode !== 200) {
      throw new Error(`Dashboard health failed: ${dashboard.statusCode}`)
    }
    if (api.statusCode !== 200) {
      throw new Error(`API health failed: ${api.statusCode}`)
    }

    console.log('Hermes sidecar smoke test passed.')
  } finally {
    await manager.stop()
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 800))
    await rm(testRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
}
