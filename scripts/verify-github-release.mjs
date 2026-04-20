import assert from 'node:assert/strict'

const owner = process.env.GITHUB_OWNER ?? 'laolaoshiren'
const repo = process.env.GITHUB_REPO ?? 'hermes-agent-desktop'
const tag = process.env.GITHUB_TAG ?? 'v0.1.0'
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? ''

function buildHeaders(extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hermes-agent-desktop-verifier',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  }
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: buildHeaders()
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 403 && body.includes('rate limit exceeded') && !token) {
      throw new Error('GitHub API rate limit exceeded. Set GITHUB_TOKEN and rerun npm run test:github.')
    }
    throw new Error(`GitHub request failed for ${url}: ${response.status} ${body}`)
  }

  return response.json()
}

async function requestReachable(url) {
  let response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers: buildHeaders()
  })

  if (response.status === 405) {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: buildHeaders({
        Range: 'bytes=0-0'
      })
    })
  }

  if (response.status >= 400) {
    throw new Error(`URL is not reachable: ${url} (${response.status})`)
  }
}

function findAsset(assets, predicate, label) {
  const asset = assets.find(predicate)
  assert.ok(asset, `Missing release asset: ${label}`)
  return asset
}

function findSuccessfulRun(payload, label) {
  const run = payload.workflow_runs.find(
    (entry) => entry.status === 'completed' && entry.conclusion === 'success'
  )
  assert.ok(run, `Missing successful workflow run for ${label}`)
  return run
}

async function main() {
  const apiBase = 'https://api.github.com'
  const repoBase = `${apiBase}/repos/${owner}/${repo}`

  const repoInfo = await requestJson(repoBase)
  assert.equal(repoInfo.name, repo)
  assert.equal(repoInfo.private, false)
  assert.equal(repoInfo.archived, false)

  const release = await requestJson(`${repoBase}/releases/tags/${tag}`)
  assert.equal(release.tag_name, tag)
  assert.equal(release.draft, false)
  assert.equal(release.prerelease, false)

  const assets = release.assets ?? []
  const requiredAssets = [
    findAsset(assets, (asset) => asset.name.includes('setup') && asset.name.endsWith('.exe'), 'Windows setup'),
    findAsset(
      assets,
      (asset) => asset.name.includes('portable') && asset.name.endsWith('.exe'),
      'Windows portable'
    ),
    findAsset(assets, (asset) => asset.name.endsWith('.dmg'), 'macOS dmg'),
    findAsset(assets, (asset) => asset.name.endsWith('.zip'), 'macOS zip'),
    findAsset(assets, (asset) => asset.name.endsWith('.AppImage'), 'Linux AppImage'),
    findAsset(assets, (asset) => asset.name.endsWith('.tar.gz'), 'Linux tar.gz')
  ]

  for (const asset of requiredAssets) {
    await requestReachable(asset.browser_download_url)
  }

  const ciRuns = await requestJson(`${repoBase}/actions/workflows/ci.yml/runs?branch=main&per_page=10`)
  const releaseRuns = await requestJson(`${repoBase}/actions/workflows/release.yml/runs?per_page=10`)
  const latestCi = findSuccessfulRun(ciRuns, 'CI')
  const latestRelease = findSuccessfulRun(releaseRuns, 'Release')

  const readmeMedia = [
    'docs/media/hermes-agent-desktop-banner.svg',
    'docs/media/hermes-agent-desktop-highlights.svg',
    'docs/media/hermes-agent-desktop-ui.svg'
  ]

  for (const mediaPath of readmeMedia) {
    await requestReachable(`https://raw.githubusercontent.com/${owner}/${repo}/main/${mediaPath}`)
  }

  console.log(
    JSON.stringify(
      {
        repository: repoInfo.html_url,
        release: release.html_url,
        verifiedTag: tag,
        assets: requiredAssets.map((asset) => asset.name),
        workflows: {
          ci: {
            id: latestCi.id,
            html_url: latestCi.html_url,
            conclusion: latestCi.conclusion
          },
          release: {
            id: latestRelease.id,
            html_url: latestRelease.html_url,
            conclusion: latestRelease.conclusion
          }
        }
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
