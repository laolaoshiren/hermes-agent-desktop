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
$productName = 'Hermes Agent Console'

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
  $unpackedRuntime = Join-Path $releaseDir 'win-unpacked\resources\app.asar.unpacked\runtime\python\python.exe'
  $unpackedDashboard = Join-Path $releaseDir 'win-unpacked\resources\app.asar.unpacked\vendor\hermes-agent\hermes_cli\web_dist\index.html'

  if (-not (Test-Path $asarPath)) {
    throw "Missing packaged app.asar at $asarPath"
  }
  if (-not (Test-Path $unpackedRuntime)) {
    throw "Bundled Python runtime is missing from app.asar.unpacked: $unpackedRuntime"
  }
  if (-not (Test-Path $unpackedDashboard)) {
    throw "Bundled Hermes dashboard assets are missing from app.asar.unpacked: $unpackedDashboard"
  }

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

  Start-And-VerifyApp -ExePath $installedExe -Label 'installed app'
  Start-And-VerifyApp -ExePath $portableExe -Label 'portable app'

  Write-Host 'Windows package verification passed.'
}
finally {
  $escapedInstallDir = [Regex]::Escape($installDir)

  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -like 'Hermes Agent Console*' -or
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
