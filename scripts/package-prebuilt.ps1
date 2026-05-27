param(
  [string]$OutputDir = "three-kingdoms-upload",
  [string]$PackageName = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Convert-ToZipEntryName {
  param(
    [string]$Path
  )

  return ($Path -replace "\\", "/").TrimStart("/")
}

function Join-ZipEntryName {
  param(
    [string]$Base,
    [string]$Child
  )

  if ([string]::IsNullOrWhiteSpace($Child)) {
    return (Convert-ToZipEntryName $Base)
  }

  return (Convert-ToZipEntryName ($Base + "\" + $Child))
}

function Get-RelativeChildPath {
  param(
    [string]$RootPath,
    [string]$Path
  )

  if (-not $Path.StartsWith($RootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path '$Path' is not under root '$RootPath'"
  }

  return $Path.Substring($RootPath.Length).TrimStart("\")
}

function Clear-ReadOnlyRecursively {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $rootItem = Get-Item -LiteralPath $Path -Force
  $rootItem.Attributes = $rootItem.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)

  Get-ChildItem -LiteralPath $Path -Recurse -Force | ForEach-Object {
    $_.Attributes = $_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
  }
}

function Remove-ItemForcefully {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Clear-ReadOnlyRecursively -Path $Path
  Remove-Item -LiteralPath $Path -Recurse -Force
}

function Should-ExcludeRelativePath {
  param(
    [string]$RelativePath,
    [string[]]$ExcludeDirectories = @(),
    [string[]]$ExcludeFiles = @()
  )

  $normalizedPath = Convert-ToZipEntryName $RelativePath

  foreach ($directory in $ExcludeDirectories) {
    $normalizedDirectory = (Convert-ToZipEntryName $directory).TrimEnd("/")
    if (
      $normalizedPath.Equals($normalizedDirectory, [System.StringComparison]::OrdinalIgnoreCase) -or
      $normalizedPath.StartsWith($normalizedDirectory + "/", [System.StringComparison]::OrdinalIgnoreCase)
    ) {
      return $true
    }
  }

  foreach ($file in $ExcludeFiles) {
    $normalizedFile = Convert-ToZipEntryName $file
    if ($normalizedPath.Equals($normalizedFile, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }

  return $false
}

function Copy-FileWithParent {
  param(
    [string]$SourcePath,
    [string]$DestinationPath
  )

  $parentDirectory = Split-Path -Parent $DestinationPath
  if ($parentDirectory) {
    New-Item -ItemType Directory -Force -Path $parentDirectory | Out-Null
  }

  [System.IO.File]::Copy($SourcePath, $DestinationPath, $true)
}

function Copy-DirectoryTree {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [string[]]$ExcludeDirectories = @(),
    [string[]]$ExcludeFiles = @()
  )

  $sourceRoot = (Get-Item -LiteralPath $SourcePath -Force).FullName.TrimEnd("\")
  New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null

  $directories = Get-ChildItem -LiteralPath $sourceRoot -Directory -Recurse | Sort-Object FullName
  foreach ($directory in $directories) {
    $relativePath = Get-RelativeChildPath -RootPath $sourceRoot -Path $directory.FullName
    if (Should-ExcludeRelativePath -RelativePath $relativePath -ExcludeDirectories $ExcludeDirectories -ExcludeFiles $ExcludeFiles) {
      continue
    }

    $targetDirectory = Join-Path $DestinationPath $relativePath
    New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  }

  $files = Get-ChildItem -LiteralPath $sourceRoot -File -Recurse | Sort-Object FullName
  foreach ($file in $files) {
    $relativePath = Get-RelativeChildPath -RootPath $sourceRoot -Path $file.FullName
    if (Should-ExcludeRelativePath -RelativePath $relativePath -ExcludeDirectories $ExcludeDirectories -ExcludeFiles $ExcludeFiles) {
      continue
    }

    $targetFile = Join-Path $DestinationPath $relativePath
    Copy-FileWithParent -SourcePath $file.FullName -DestinationPath $targetFile
  }
}

function New-ZipFromDirectory {
  param(
    [string]$SourceDirectory,
    [string]$DestinationZip
  )

  $sourceDir = (Get-Item -LiteralPath $SourceDirectory -Force).FullName.TrimEnd("\")
  $rootEntry = Convert-ToZipEntryName (Split-Path -Leaf $sourceDir)

  $zip = [System.IO.Compression.ZipFile]::Open($DestinationZip, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $null = $zip.CreateEntry($rootEntry + "/")

    $directories = Get-ChildItem -LiteralPath $sourceDir -Directory -Recurse | Sort-Object FullName
    foreach ($directory in $directories) {
      $relativePath = Get-RelativeChildPath -RootPath $sourceDir -Path $directory.FullName
      $entryName = Join-ZipEntryName -Base $rootEntry -Child $relativePath
      if ($entryName) {
        $null = $zip.CreateEntry($entryName + "/")
      }
    }

    $files = Get-ChildItem -LiteralPath $sourceDir -File -Recurse | Sort-Object FullName
    foreach ($file in $files) {
      $relativePath = Get-RelativeChildPath -RootPath $sourceDir -Path $file.FullName
      $entryName = Join-ZipEntryName -Base $rootEntry -Child $relativePath
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip,
        $file.FullName,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    $zip.Dispose()
  }
}

$root = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($PackageName)) {
  $PackageName = "three-kingdoms-lightweight-$timestamp"
}

$outputRoot = Join-Path $root $OutputDir
$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("three-kingdoms-package-" + [System.Guid]::NewGuid().ToString("N"))
$stageDir = Join-Path $stageRoot $PackageName
$zipPath = Join-Path $outputRoot ($PackageName + ".zip")

Write-Host "[package] project root: $root"
Write-Host "[package] output root: $outputRoot"

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null

if (Test-Path $zipPath) {
  Remove-ItemForcefully -Path $zipPath
}

Push-Location $root
try {
  Write-Host "[package] installing dependencies"
  npm ci

  Write-Host "[package] building dist assets"
  npm run build

  if (-not (Test-Path (Join-Path $root "dist\index.html"))) {
    throw "dist\index.html not found after build"
  }

  New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

  $directories = @(
    @{ Name = "dist"; ExcludeDirectories = @(); ExcludeFiles = @() },
    @{ Name = "server"; ExcludeDirectories = @("runtime"); ExcludeFiles = @("config/provider.config.json") },
    @{ Name = "static"; ExcludeDirectories = @(); ExcludeFiles = @() },
    @{ Name = "scripts"; ExcludeDirectories = @(); ExcludeFiles = @() },
    @{ Name = "deploy"; ExcludeDirectories = @(); ExcludeFiles = @() }
  )

  foreach ($dir in $directories) {
    $source = Join-Path $root $dir.Name
    $target = Join-Path $stageDir $dir.Name
    Write-Host "[package] copying directory: $($dir.Name)"
    Copy-DirectoryTree `
      -SourcePath $source `
      -DestinationPath $target `
      -ExcludeDirectories $dir.ExcludeDirectories `
      -ExcludeFiles $dir.ExcludeFiles
  }

  $files = @(
    "package.json",
    "package-lock.json"
  )

  foreach ($file in $files) {
    $source = Join-Path $root $file
    $target = Join-Path $stageDir $file
    Write-Host "[package] copying file: $file"
    Copy-FileWithParent -SourcePath $source -DestinationPath $target
  }

  New-ZipFromDirectory -SourceDirectory $stageDir -DestinationZip $zipPath
  Write-Host "[package] zip created: $zipPath"
} finally {
  Pop-Location
  if (Test-Path $stageRoot) {
    Remove-ItemForcefully -Path $stageRoot
  }
}
