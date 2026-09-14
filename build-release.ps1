[CmdletBinding()]
param(
    [switch]$NoVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionDirectory = Join-Path $repositoryRoot 'dl_shiwake'
$manifestPath = Join-Path $extensionDirectory 'manifest.json'

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json was not found: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($manifest.version)) {
    throw 'The manifest version is missing.'
}

$version = [string]$manifest.version
$outputPath = Join-Path $repositoryRoot ("dl-shiwake-{0}.zip" -f $version)
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("dl-shiwake-release-{0}" -f ([guid]::NewGuid().ToString('N')))

$files = @(
    'manifest.json'
    'background.js'
    'options.html'
    'options.js'
)

try {
    New-Item -ItemType Directory -Path (Join-Path $stagingDirectory 'icons') -Force | Out-Null

    foreach ($file in $files) {
        $sourcePath = Join-Path $extensionDirectory $file
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Required file was not found: $sourcePath"
        }
        Copy-Item -LiteralPath $sourcePath -Destination $stagingDirectory -Force
    }

    $iconDirectory = Join-Path $extensionDirectory 'icons'
    if (-not (Test-Path -LiteralPath $iconDirectory -PathType Container)) {
        throw "Icons directory was not found: $iconDirectory"
    }
    Copy-Item -Path (Join-Path $iconDirectory '*') -Destination (Join-Path $stagingDirectory 'icons') -Force

    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }
    Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $outputPath -Force

    if (-not $NoVerify) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::OpenRead($outputPath)
        try {
            $entries = @($archive.Entries | Select-Object -ExpandProperty FullName)
            if ($entries -notcontains 'manifest.json') {
                throw 'manifest.json is not at the ZIP root.'
            }
            if ($entries -contains 'README.md' -or $entries -contains 'LICENSE') {
                throw 'Documentation or license files must not be included in the extension package.'
            }
        }
        finally {
            $archive.Dispose()
        }
    }

    Write-Output "Created: $outputPath"
    Write-Output "Version: $version"
    Write-Output "Size: $((Get-Item -LiteralPath $outputPath).Length) bytes"
}
finally {
    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
}
