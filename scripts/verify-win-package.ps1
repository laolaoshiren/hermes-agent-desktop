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
$installDir = Join-Path $repoRoot '.test-install-win'
$appProcessName = 'Hermes Agent Desktop.exe'

function Get-NewAppProcesses {
  param(
    [int[]]$KnownProcessIds
  )

  $known = @($KnownProcessIds)
  return [object[]]@(
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -eq $appProcessName -and $known -notcontains [int]$_.ProcessId
      }
  )
}

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
  $knownProcessIds = @(
    Get-CimInstance Win32_Process |
      Where-Object { $_.Name -eq $appProcessName } |
      Select-Object -ExpandProperty ProcessId
  )

  Start-Process -FilePath $ExePath | Out-Null

  $launched = @()
  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    Start-Sleep -Seconds 1
    $launched = @(Get-NewAppProcesses -KnownProcessIds $knownProcessIds)
    if (@($launched).Count -gt 0) {
      break
    }
  }

  if (@($launched).Count -eq 0) {
    throw "$Label did not start a new desktop process."
  }

  Start-Sleep -Seconds 5
  $alive = @(Get-NewAppProcesses -KnownProcessIds $knownProcessIds)
  if (@($alive).Count -eq 0) {
    throw "$Label exited immediately after launch."
  }

  $alive | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
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

  $setupExe = Find-Artifact -Pattern 'Hermes Agent Desktop-*-setup-*.exe'
  $portableExe = Find-Artifact -Pattern 'Hermes Agent Desktop-*-portable-*.exe'
  $asarPath = Join-Path $releaseDir 'win-unpacked\resources\app.asar'

  if (-not (Test-Path $asarPath)) {
    throw "Missing packaged app.asar at $asarPath"
  }

  Write-Host 'Checking packaged runtime dependency layout...'
  $asarListing = cmd /c "npx asar list `"$asarPath`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to inspect app.asar.'
  }

  if (-not (($asarListing | Out-String) -match '\\node_modules\\debug\\src\\index\.js')) {
    throw 'debug/src/index.js is missing from app.asar; the Windows crash regression is back.'
  }

  if (Test-Path $installDir) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
  }

  New-Item -ItemType Directory -Path $installDir | Out-Null

  Write-Host "Silent-installing setup package to $installDir ..."
  Start-Process -FilePath $setupExe -ArgumentList '/S', "/D=$installDir" -Wait

  $installedExe = Join-Path $installDir 'Hermes Agent Desktop.exe'
  if (-not (Test-Path $installedExe)) {
    throw "Installed executable not found at $installedExe"
  }

  Start-And-VerifyApp -ExePath $installedExe -Label 'installed app'
  Start-And-VerifyApp -ExePath $portableExe -Label 'portable app'

  Write-Host 'Windows package verification passed.'
}
finally {
  Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq $appProcessName } |
    ForEach-Object {
      try {
        Stop-Process -Id $_.ProcessId -Force
      }
      catch {
      }
    }

  Start-Sleep -Seconds 3
  if (Test-Path $installDir) {
    $removed = $false
    for ($attempt = 0; $attempt -lt 5; $attempt++) {
      try {
        Remove-Item -LiteralPath $installDir -Recurse -Force
        $removed = $true
        break
      }
      catch {
        Start-Sleep -Seconds 2
      }
    }

    if (-not $removed -and (Test-Path $installDir)) {
      Write-Warning "Could not fully remove $installDir after verification."
    }
  }
}
