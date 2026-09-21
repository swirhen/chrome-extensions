[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ExtensionName,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Version,

    [switch]$NoVerify,

    # ZIP作成のみ行い、git操作（コミット・タグ・プッシュ）をスキップする
    [switch]$NoPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# バージョン形式の検証（Major.Minor.Patch 形式）
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Invalid version format '$Version'. Expected Major.Minor.Patch (e.g. 1.0.3)"
}

$repositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionDirectory = Join-Path $repositoryRoot $ExtensionName
$manifestPath = Join-Path $extensionDirectory 'manifest.json'
$licensePath = Join-Path $repositoryRoot 'LICENSE'

if (-not (Test-Path -LiteralPath $extensionDirectory -PathType Container)) {
    throw "Extension directory was not found: $extensionDirectory"
}
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json was not found: $manifestPath"
}
if (-not (Test-Path -LiteralPath $licensePath -PathType Leaf)) {
    throw "LICENSE was not found: $licensePath"
}

# manifest.json のバージョンを引数で上書き
$manifestRaw = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
$manifest = $manifestRaw | ConvertFrom-Json
$oldVersion = [string]$manifest.version

if ($oldVersion -ne $Version) {
    Write-Output "Updating manifest version: $oldVersion -> $Version"
    # JSON文字列内の "version": "x.x.x" を直接置換（整形を保持するため）
    $manifestRaw = $manifestRaw -replace '"version"\s*:\s*"[^"]*"', "`"version`": `"$Version`""
    [System.IO.File]::WriteAllText($manifestPath, $manifestRaw, [System.Text.Encoding]::UTF8)
    $manifest = $manifestRaw | ConvertFrom-Json
} else {
    Write-Output "Manifest version is already $Version"
}

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
            $resourcePath -match '(^|[\\/])\.\.([\/]|$)') {
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

# 拡張機能名のハイフン変換（アンダースコア → ハイフン、出力ファイル名用）
$extensionSlug = $ExtensionName -replace '_', '-'
$tagName = "${ExtensionName}-v${Version}"
$outputPath = Join-Path $repositoryRoot ("{0}-{1}.zip" -f $extensionSlug, $Version)
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("{0}-release-{1}" -f $ExtensionName, ([guid]::NewGuid().ToString('N')))
$existingArchives = Get-ChildItem -LiteralPath $repositoryRoot -Filter "${extensionSlug}-*.zip" -File

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
    Write-Output "Version: $Version"
    Write-Output "Size: $((Get-Item -LiteralPath $outputPath).Length) bytes"

    # git コミット・タグ・プッシュ
    if (-not $NoPush) {
        Push-Location $repositoryRoot
        try {
            git add "$ExtensionName/manifest.json"
            $status = git status --porcelain
            if ($status) {
                git commit -m "release: $ExtensionName v$Version"
            } else {
                Write-Output "No changes to manifest.json, skipping commit."
            }
            git tag $tagName
            git push origin HEAD
            git push origin $tagName
            Write-Output "Tag pushed: $tagName"
        }
        finally {
            Pop-Location
        }
    }
}
finally {
    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
}
