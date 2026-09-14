[CmdletBinding()]
param(
    [switch]$NoVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionDirectory = Join-Path $repositoryRoot 'dl_shiwake'
$manifestPath = Join-Path $extensionDirectory 'manifest.json'
$licensePath = Join-Path $repositoryRoot 'LICENSE'

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json was not found: $manifestPath"
}
if (-not (Test-Path -LiteralPath $licensePath -PathType Leaf)) {
    throw "LICENSE was not found: $licensePath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($manifest.version)) {
    throw 'The manifest version is missing.'
}

function Add-ManifestResourcePath {
    param(
        [System.Collections.Generic.HashSet[string]]$ResourcePaths,
        [object]$Value
    )

    if ($Value -is [string] -and -not [string]::IsNullOrWhiteSpace($Value)) {
        [void]$ResourcePaths.Add($Value)
    }
}

function Get-ManifestProperty {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) {
        return $Object.PSObject.Properties[$Name].Value
    }
}

function Add-ManifestResourcePaths {
    param(
        [System.Collections.Generic.HashSet[string]]$ResourcePaths,
        [object]$Values
    )

    foreach ($value in @($Values)) {
        Add-ManifestResourcePath -ResourcePaths $ResourcePaths -Value $value
    }
}

function Add-IconResourcePaths {
    param(
        [System.Collections.Generic.HashSet[string]]$ResourcePaths,
        [object]$Icons
    )

    if ($Icons -is [string]) {
        Add-ManifestResourcePath -ResourcePaths $ResourcePaths -Value $Icons
        return
    }

    if ($null -ne $Icons) {
        Add-ManifestResourcePaths -ResourcePaths $ResourcePaths -Values $Icons.PSObject.Properties.Value
    }
}

function Test-ManifestResourcePaths {
    param(
        [string]$ExtensionDirectory,
        [System.Collections.Generic.HashSet[string]]$ResourcePaths
    )

    foreach ($resourcePath in $ResourcePaths) {
        if ([System.IO.Path]::IsPathRooted($resourcePath) -or
            $resourcePath -match '(^|[\\/])\.\.([\\/]|$)') {
            throw "Manifest resource path must be relative and must not contain '..': $resourcePath"
        }

        $sourcePath = Join-Path $ExtensionDirectory ($resourcePath -replace '/', '\')
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Manifest resource was not found: $resourcePath"
        }
    }
}

$manifestResourcePaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$background = Get-ManifestProperty -Object $manifest -Name 'background'
$optionsUi = Get-ManifestProperty -Object $manifest -Name 'options_ui'
$action = Get-ManifestProperty -Object $manifest -Name 'action'
$sidePanel = Get-ManifestProperty -Object $manifest -Name 'side_panel'
$sandbox = Get-ManifestProperty -Object $manifest -Name 'sandbox'
$chromeUrlOverrides = Get-ManifestProperty -Object $manifest -Name 'chrome_url_overrides'

Add-IconResourcePaths -ResourcePaths $manifestResourcePaths -Icons (Get-ManifestProperty -Object $manifest -Name 'icons')
Add-ManifestResourcePath -ResourcePaths $manifestResourcePaths -Value (Get-ManifestProperty -Object $background -Name 'service_worker')
Add-ManifestResourcePaths -ResourcePaths $manifestResourcePaths -Values (Get-ManifestProperty -Object $background -Name 'scripts')
Add-ManifestResourcePath -ResourcePaths $manifestResourcePaths -Value (Get-ManifestProperty -Object $manifest -Name 'options_page')
Add-ManifestResourcePath -ResourcePaths $manifestResourcePaths -Value (Get-ManifestProperty -Object $optionsUi -Name 'page')
Add-ManifestResourcePath -ResourcePaths $manifestResourcePaths -Value (Get-ManifestProperty -Object $action -Name 'default_popup')
Add-IconResourcePaths -ResourcePaths $manifestResourcePaths -Icons (Get-ManifestProperty -Object $action -Name 'default_icon')
Add-ManifestResourcePath -ResourcePaths $manifestResourcePaths -Value (Get-ManifestProperty -Object $sidePanel -Name 'default_path')
Add-ManifestResourcePaths -ResourcePaths $manifestResourcePaths -Values (Get-ManifestProperty -Object $sandbox -Name 'pages')

if ($null -ne $chromeUrlOverrides) {
    Add-ManifestResourcePaths -ResourcePaths $manifestResourcePaths -Values $chromeUrlOverrides.PSObject.Properties.Value
}

foreach ($contentScript in @(Get-ManifestProperty -Object $manifest -Name 'content_scripts')) {
    Add-ManifestResourcePaths -ResourcePaths $manifestResourcePaths -Values (Get-ManifestProperty -Object $contentScript -Name 'js')
    Add-ManifestResourcePaths -ResourcePaths $manifestResourcePaths -Values (Get-ManifestProperty -Object $contentScript -Name 'css')
}

foreach ($webAccessibleResource in @(Get-ManifestProperty -Object $manifest -Name 'web_accessible_resources')) {
    Add-ManifestResourcePaths -ResourcePaths $manifestResourcePaths -Values (Get-ManifestProperty -Object $webAccessibleResource -Name 'resources')
}

$defaultLocale = Get-ManifestProperty -Object $manifest -Name 'default_locale'
if (-not [string]::IsNullOrWhiteSpace($defaultLocale)) {
    Add-ManifestResourcePath -ResourcePaths $manifestResourcePaths -Value "_locales/$defaultLocale/messages.json"
}

Test-ManifestResourcePaths -ExtensionDirectory $extensionDirectory -ResourcePaths $manifestResourcePaths

$version = [string]$manifest.version
$outputPath = Join-Path $repositoryRoot ("dl-shiwake-{0}.zip" -f $version)
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("dl-shiwake-release-{0}" -f ([guid]::NewGuid().ToString('N')))
$existingArchives = Get-ChildItem -LiteralPath $repositoryRoot -Filter 'dl-shiwake-*.zip' -File

try {
    foreach ($archive in $existingArchives) {
        Remove-Item -LiteralPath $archive.FullName -Force
    }

    foreach ($file in Get-ChildItem -LiteralPath $extensionDirectory -Recurse -File) {
        if ($file.Name -in @('README.md', 'LICENSE')) {
            continue
        }

        $relativePath = $file.FullName.Substring($extensionDirectory.Length).TrimStart('\', '/')
        $destinationPath = Join-Path $stagingDirectory $relativePath
        New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destinationPath -Force
    }
    Copy-Item -LiteralPath $licensePath -Destination (Join-Path $stagingDirectory 'LICENSE') -Force

    Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $outputPath -Force

    if (-not $NoVerify) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::OpenRead($outputPath)
        try {
            $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
            if ($entries -notcontains 'manifest.json') {
                throw 'manifest.json is not at the ZIP root.'
            }
            if ($entries -contains 'README.md') {
                throw 'Documentation files must not be included in the extension package.'
            }
            if ($entries -notcontains 'LICENSE') {
                throw 'LICENSE is missing from the extension package.'
            }
            foreach ($resourcePath in $manifestResourcePaths) {
                if ($entries -notcontains $resourcePath.Replace('\', '/')) {
                    throw "Manifest resource is missing from the ZIP: $resourcePath"
                }
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
