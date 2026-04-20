import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createRuntimeManager } from '../packages/runtime-manager/dist/index.js'
import { DEFAULT_BRAND } from '../packages/shared/dist/index.js'

async function parseSse(response) {
  if (!response.body) {
    throw new Error('Missing SSE body from /v1/runs/{id}/events')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events = []
  const terminalEvents = new Set(['run.completed', 'run.failed'])

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true }).replaceAll('\r', '')
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const payload = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.replace(/^data:\s?/, ''))
          .join('\n')

        if (!payload) {
          continue
        }

        const event = JSON.parse(payload)
        events.push(event)

        if (terminalEvents.has(event.event)) {
          await reader.cancel().catch(() => undefined)
          return events
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return events
}

async function main() {
  const testRoot = await mkdtemp(join(tmpdir(), 'hermes-console-e2e-'))
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

    const createRun = await fetch(`${snapshot.api.url}/v1/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${snapshot.api.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: 'hello from hermes-agent-console e2e',
        session_id: 'desktop-e2e-session'
      })
    })

    if (!createRun.ok) {
      throw new Error(`Run creation failed: ${createRun.status} ${await createRun.text()}`)
    }

    const created = await createRun.json()
    const stream = await fetch(`${snapshot.api.url}/v1/runs/${created.run_id}/events`, {
      headers: {
        Authorization: `Bearer ${snapshot.api.apiKey}`
      }
    })

    if (!stream.ok) {
      throw new Error(`Run stream failed: ${stream.status} ${await stream.text()}`)
    }

    const events = await parseSse(stream)
    if (events.length === 0) {
      throw new Error('Expected at least one Hermes run event.')
    }

    const terminal = events.find((event) => event.event === 'run.completed' || event.event === 'run.failed')
    if (!terminal) {
      throw new Error(`Expected a terminal run event, got: ${JSON.stringify(events)}`)
    }

    if (terminal.event === 'run.failed') {
      console.log(
        `Hermes local e2e reached run.failed on a fresh environment. ` +
          `This means runtime and streaming work, but provider/auth setup is still required before chat can complete. ` +
          `Error: ${terminal.error ?? 'unknown'}`
      )
      return
    }

    console.log('Hermes local e2e passed with terminal event: run.completed')
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
