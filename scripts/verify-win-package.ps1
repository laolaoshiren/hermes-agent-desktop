param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) {
  $global:PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$verifyRunId = Get-Date -Format 'yyyyMMddHHmmss'
$releaseDirName = if ($SkipBuild) { 'release' } else { ".package-verify-release-$verifyRunId" }
$releaseDir = Join-Path $repoRoot $releaseDirName
$installDir = Join-Path $repoRoot ".test-install-win-$verifyRunId"
$productName = 'Hermes Agent Desktop'

function Find-Artifact {
  param(
    [string]$Pattern
  )

  $match = Get-ChildItem -Path $releaseDir -Filter $Pattern -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $match) {
    throw "Missing artifact: $Pattern"
  }

  return $match.FullName
}

function Remove-DirectoryWithRetries {
  param(
    [string]$TargetPath
  )

  if (-not (Test-Path $TargetPath)) {
    return
  }

  for ($attempt = 0; $attempt -lt 8; $attempt++) {
    try {
      Remove-Item -LiteralPath $TargetPath -Recurse -Force
      return
    }
    catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "Could not remove directory: $TargetPath"
}

function Start-And-VerifyApp {
  param(
    [string]$ExePath,
    [string]$Label
  )

  Write-Host "Launching $Label..."
  $process = Start-Process -FilePath $ExePath -PassThru

  if (-not $process) {
    throw "$Label did not start."
  }

  Start-Sleep -Seconds 8
  $alive = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
  if (-not $alive) {
    throw "$Label exited immediately after launch."
  }

  Stop-Process -Id $alive.Id -Force
}

function Assert-PortablePythonRuntime {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RuntimeRoot,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $pythonExe = Join-Path $RuntimeRoot 'python.exe'
  $pythonPathFile = Join-Path $RuntimeRoot 'python311._pth'
  $venvMarker = Join-Path $RuntimeRoot 'pyvenv.cfg'
  $venvPythonExe = Join-Path $RuntimeRoot 'Scripts\python.exe'

  if (-not (Test-Path $pythonExe)) {
    throw "$Label runtime is missing embedded python.exe at $pythonExe"
  }
  if (-not (Test-Path $pythonPathFile)) {
    throw "$Label runtime is missing python311._pth at $pythonPathFile"
  }
  if (Test-Path $venvMarker) {
    throw "$Label runtime contains pyvenv.cfg and is not portable: $venvMarker"
  }
  if (Test-Path $venvPythonExe) {
    throw "$Label runtime still exposes a venv python launcher: $venvPythonExe"
  }

  $pythonPathContent = Get-Content -LiteralPath $pythonPathFile -Raw
  foreach ($requiredLine in @('python311.zip', '.', 'Lib', 'Lib\site-packages', 'import site')) {
    if ($pythonPathContent -notmatch [Regex]::Escape($requiredLine)) {
      throw "$Label runtime python311._pth is missing required entry '$requiredLine'."
    }
  }

  $probeScript = @'
import json
import os
import sys

runtime_root = os.path.dirname(sys.executable)
print(json.dumps({
    'executable': sys.executable,
    'prefix': sys.prefix,
    'base_prefix': sys.base_prefix,
    'exec_prefix': sys.exec_prefix,
    'base_exec_prefix': sys.base_exec_prefix,
    'has_pth': os.path.exists(os.path.join(runtime_root, 'python311._pth')),
    'has_pyvenv': os.path.exists(os.path.join(runtime_root, 'pyvenv.cfg')),
    'has_scripts_python': os.path.exists(os.path.join(runtime_root, 'Scripts', 'python.exe'))
}))
'@

  $probeJson = & $pythonExe -c $probeScript 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw "$Label runtime probe failed: $probeJson"
  }

  $probe = $probeJson | ConvertFrom-Json
  $resolvedRuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot).Path
  $resolvedPythonExe = (Resolve-Path -LiteralPath $pythonExe).Path

  if ($probe.executable -ne $resolvedPythonExe) {
    throw "$Label runtime probe resolved the wrong executable: $($probe.executable)"
  }
  if (-not $probe.has_pth) {
    throw "$Label runtime probe did not detect python311._pth."
  }
  if ($probe.has_pyvenv) {
    throw "$Label runtime probe detected pyvenv.cfg."
  }
  if ($probe.has_scripts_python) {
    throw "$Label runtime probe detected Scripts\\python.exe."
  }

  foreach ($field in @('prefix', 'base_prefix', 'exec_prefix', 'base_exec_prefix')) {
    if ($probe.$field -ne $resolvedRuntimeRoot) {
      throw "$Label runtime probe returned $field='$($probe.$field)' instead of '$resolvedRuntimeRoot'."
    }
  }
}

try {
  if (-not $SkipBuild) {
    Write-Host 'Running Windows packaging build...'
    $buildOutput = cmd /c "npm run build 2>&1 && npx electron-builder --win nsis portable --publish never --config.directories.output=$releaseDirName 2>&1"
    $buildOutput | ForEach-Object { Write-Host $_ }

    if ($LASTEXITCODE -ne 0) {
      throw 'Windows packaging command failed.'
    }

    if (($buildOutput | Out-String) -match 'default Electron icon is used') {
      throw 'Windows package still fell back to the default Electron icon.'
    }
  }

  if (-not (Test-Path $releaseDir)) {
    throw 'Release directory was not created.'
  }

  $setupExe = Find-Artifact -Pattern "$productName-*-setup-*.exe"
  $portableExe = Find-Artifact -Pattern "$productName-*-portable-*.exe"
  $asarPath = Join-Path $releaseDir 'win-unpacked\resources\app.asar'
  $unpackedRuntimeRoot = Join-Path $releaseDir 'win-unpacked\resources\app.asar.unpacked\runtime\python'
  $unpackedDashboard = Join-Path $releaseDir 'win-unpacked\resources\app.asar.unpacked\vendor\hermes-agent\hermes_cli\web_dist\index.html'
  $unpackedRuntimeContainer = Join-Path $releaseDir 'win-unpacked\resources\app.asar.unpacked\runtime'

  if (-not (Test-Path $asarPath)) {
    throw "Missing packaged app.asar at $asarPath"
  }
  if (-not (Test-Path $unpackedRuntimeRoot)) {
    throw "Bundled Python runtime root is missing from app.asar.unpacked: $unpackedRuntimeRoot"
  }
  if (-not (Test-Path $unpackedDashboard)) {
    throw "Bundled Hermes dashboard assets are missing from app.asar.unpacked: $unpackedDashboard"
  }

  [string[]]$unexpectedRuntimeDirs = @()
  if (Test-Path $unpackedRuntimeContainer) {
    [string[]]$unexpectedRuntimeDirs = @(
      Get-ChildItem -Path $unpackedRuntimeContainer -Directory |
        Where-Object { $_.Name -like 'python*' -and $_.Name -ne 'python' } |
        Select-Object -ExpandProperty FullName
    )
  }
  if ($unexpectedRuntimeDirs.Count -gt 0) {
    throw "Unexpected extra Python runtime directories were packaged: $($unexpectedRuntimeDirs -join ', ')"
  }

  Write-Host 'Checking bundled Python runtime layout...'
  Assert-PortablePythonRuntime -RuntimeRoot $unpackedRuntimeRoot -Label 'win-unpacked'

  Write-Host 'Checking packaged runtime dependency layout...'
  $asarListing = cmd /c "npx asar list `"$asarPath`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to inspect app.asar.'
  }

  $asarText = $asarListing | Out-String
  if (-not ($asarText -match 'apps\\desktop\\electron\\dist\\main\\index\.js')) {
    throw 'Electron main bundle is missing from app.asar.'
  }
  if (-not ($asarText -match 'apps\\desktop\\frontend\\dist\\index\.html')) {
    throw 'Frontend bundle is missing from app.asar.'
  }

  if (Test-Path $installDir) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
  }

  New-Item -ItemType Directory -Path $installDir | Out-Null

  Write-Host "Silent-installing setup package to $installDir ..."
  Start-Process -FilePath $setupExe -ArgumentList '/S', "/D=$installDir" -Wait

  $installedExe = Join-Path $installDir "$productName.exe"
  if (-not (Test-Path $installedExe)) {
    throw "Installed executable not found at $installedExe"
  }

  $installedRuntimeRoot = Join-Path $installDir 'resources\app.asar.unpacked\runtime\python'
  if (-not (Test-Path $installedRuntimeRoot)) {
    throw "Installed runtime root is missing: $installedRuntimeRoot"
  }

  Write-Host 'Checking installed Python runtime layout...'
  Assert-PortablePythonRuntime -RuntimeRoot $installedRuntimeRoot -Label 'installed app'

  Start-And-VerifyApp -ExePath $installedExe -Label 'installed app'
  Start-And-VerifyApp -ExePath $portableExe -Label 'portable app'

  Write-Host 'Windows package verification passed.'
}
finally {
  $escapedInstallDir = [Regex]::Escape($installDir)

  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -like 'Hermes Agent Desktop*' -or
      (($_.ExecutablePath -as [string]) -match "^$escapedInstallDir") -or
      (($_.CommandLine -as [string]) -match "$escapedInstallDir")
    } |
    ForEach-Object {
      try {
        Stop-Process -Id $_.ProcessId -Force
      }
      catch {
      }
    }

  Start-Sleep -Seconds 3
  if (Test-Path $installDir) {
    try {
      Remove-DirectoryWithRetries -TargetPath $installDir
    }
    catch {
      Write-Warning "Could not fully remove $installDir after verification."
    }
  }
}
