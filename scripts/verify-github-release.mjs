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

async function requestText(url) {
  const headers = url.startsWith('https://api.github.com')
    ? buildHeaders()
    : {
        'User-Agent': 'hermes-agent-desktop-verifier'
      }

  const response = await fetch(url, {
    headers,
    redirect: 'follow'
  })

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${await response.text()}`)
  }

  return response.text()
}

async function requestReachable(url) {
  const headers = url.startsWith('https://api.github.com')
    ? buildHeaders()
    : {
        'User-Agent': 'hermes-agent-desktop-verifier'
      }

  let response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers
  })

  if (response.status === 405) {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        ...headers,
        Range: 'bytes=0-0'
      }
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractReleaseAssetsFromHtml(html) {
  const pattern = new RegExp(
    `/${escapeRegex(owner)}/${escapeRegex(repo)}/releases/download/${escapeRegex(tag)}/([^"'?#\\s<]+)`,
    'g'
  )
  const assetNames = new Set()

  for (const match of html.matchAll(pattern)) {
    assetNames.add(decodeURIComponent(match[1]))
  }

  return [...assetNames]
}

function findAssetName(assetNames, predicate, label) {
  const asset = assetNames.find(predicate)
  assert.ok(asset, `Missing release asset: ${label}`)
  return asset
}

async function assertBadgePassing(url, label) {
  const badge = await requestText(url)
  assert.match(badge, /<title>.*passing/i, `${label} badge is not passing`)
  return url
}

async function verifyPublicFallback() {
  const repoUrl = `https://github.com/${owner}/${repo}`
  const releaseUrl = `${repoUrl}/releases/tag/${tag}`
  const expandedAssetsUrl = `${repoUrl}/releases/expanded_assets/${tag}`

  await requestReachable(repoUrl)
  await requestReachable(releaseUrl)

  const assetsHtml = await requestText(expandedAssetsUrl)
  const assetNames = extractReleaseAssetsFromHtml(assetsHtml)
  assert.ok(assetNames.length > 0, 'No release assets found on expanded assets page')

  const requiredAssets = [
    findAssetName(assetNames, (asset) => asset.includes('setup') && asset.endsWith('.exe'), 'Windows setup'),
    findAssetName(
      assetNames,
      (asset) => asset.includes('portable') && asset.endsWith('.exe'),
      'Windows portable'
    ),
    findAssetName(assetNames, (asset) => asset.endsWith('.dmg'), 'macOS dmg'),
    findAssetName(assetNames, (asset) => asset.endsWith('.zip'), 'macOS zip'),
    findAssetName(assetNames, (asset) => asset.endsWith('.AppImage'), 'Linux AppImage'),
    findAssetName(assetNames, (asset) => asset.endsWith('.tar.gz'), 'Linux tar.gz')
  ]

  for (const asset of requiredAssets) {
    await requestReachable(`${repoUrl}/releases/download/${tag}/${asset}`)
  }

  const readmeMedia = [
    'docs/media/hermes-agent-desktop-banner.svg',
    'docs/media/hermes-agent-desktop-highlights.svg',
    'docs/media/hermes-agent-desktop-ui.svg'
  ]

  for (const mediaPath of readmeMedia) {
    await requestReachable(`https://raw.githubusercontent.com/${owner}/${repo}/main/${mediaPath}`)
  }

  const ciBadge = await assertBadgePassing(
    `${repoUrl}/actions/workflows/ci.yml/badge.svg?branch=main`,
    'CI'
  )
  const releaseBadge = await assertBadgePassing(
    `${repoUrl}/actions/workflows/release.yml/badge.svg`,
    'Release'
  )

  console.log(
    JSON.stringify(
      {
        repository: repoUrl,
        release: releaseUrl,
        verifiedTag: tag,
        assets: requiredAssets,
        workflows: {
          ci: {
            badge: ciBadge,
            conclusion: 'passing'
          },
          release: {
            badge: releaseBadge,
            conclusion: 'passing'
          }
        },
        verificationMode: 'public-fallback'
      },
      null,
      2
    )
  )
}

async function main() {
  const apiBase = 'https://api.github.com'
  const repoBase = `${apiBase}/repos/${owner}/${repo}`

  let repoInfo
  try {
    repoInfo = await requestJson(repoBase)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!token && message.includes('rate limit exceeded')) {
      await verifyPublicFallback()
      return
    }
    throw error
  }

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
