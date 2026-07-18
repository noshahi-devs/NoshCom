#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Deploy NoshCom, Globalmart (Primeship) frontends + NoshCom API to the VPS.
    Does NOT touch easy-finora or any other existing project on this server.

.EXAMPLE
    # Full deploy (git pull + build frontends + publish API + iisreset)
    .\deploy-noshcom.ps1 -BuildFrontends

    # Deploy only frontends, skip API and git pull
    .\deploy-noshcom.ps1 -SkipApi -SkipGitPull -BuildFrontends

    # Deploy only API
    .\deploy-noshcom.ps1 -SkipFrontends

    # Deploy only NoshCom frontend
    .\deploy-noshcom.ps1 -Frontends noshcom -BuildFrontends

    # Deploy only Globalmart (Primeship) frontend
    .\deploy-noshcom.ps1 -Frontends globalmart -BuildFrontends

    # Quick redeploy after manual git pull (no rebuild)
    .\deploy-noshcom.ps1 -SkipGitPull -SkipApi
#>

[CmdletBinding(PositionalBinding = $false)]
param(
    # Repo location on this VPS
    [string]$RepoRoot = "C:\GitHub Projects\NoshCom",
    [string]$Branch   = "main",

    # Which frontends to deploy (noshcom | globalmart | both). "eliship" is accepted as an alias for "globalmart".
    [string[]]$Frontends = @("noshcom","globalmart"),

    # IIS site paths (must match what setup-noshcom-vps.ps1 created)
    [string]$NoshComSitePath    = "C:\sites\noshcom",
    [string]$GlobalmartSitePath = "C:\sites\eliship",
    [string]$ApiSitePath        = "C:\sites\noshcom-api",

    # Switches
    [switch]$SkipGitPull,
    [switch]$SkipApi,
    [switch]$SkipFrontends,
    [switch]$BuildFrontends,   # triggers npm ci + ng build
    [switch]$SkipIisReset
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this script in elevated PowerShell (Run as Administrator)."
    }
}

function Invoke-RobocopyMirror {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination
    )
    # Step: Verify source exists before mirroring
    if (-not (Test-Path $Source)) {
        throw "Source path not found for robocopy: $Source"
    }
    Write-Host "    Mirroring: $Source -> $Destination" -ForegroundColor DarkGray
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy $Source $Destination /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
    # Robocopy exit codes 0-7 are success; 8+ are errors
    if ($LASTEXITCODE -gt 7) {
        throw "Robocopy failed. ExitCode=$LASTEXITCODE  Src=$Source  Dst=$Destination"
    }
    Write-Host "    Robocopy OK (exit $LASTEXITCODE)" -ForegroundColor DarkGray
}

function Resolve-FrontendBuildOutput {
    param([Parameter(Mandatory)][string]$FrontendRoot)
    $distRoot = Join-Path $FrontendRoot "dist"

    # Step: Confirm dist folder was produced by the build
    if (-not (Test-Path $distRoot)) {
        throw "dist/ not found. Did you build? ($distRoot)"
    }

    # Preferred Angular 17+ output: dist/<app>/browser/index.html
    $browserDir = Get-ChildItem -Path $distRoot -Recurse -Filter index.html -File |
                  Where-Object { $_.FullName -match '\\browser\\index\.html$' } |
                  Select-Object -First 1 |
                  ForEach-Object { $_.Directory.FullName }

    if ($browserDir) {
        Write-Host "    Build output (browser/): $browserDir" -ForegroundColor DarkGray
        return $browserDir
    }

    # Fallback: any folder containing index.html
    $anyDir = Get-ChildItem -Path $distRoot -Recurse -Filter index.html -File |
              Select-Object -First 1 |
              ForEach-Object { $_.Directory.FullName }

    if ($anyDir) {
        Write-Host "    Build output (fallback): $anyDir" -ForegroundColor DarkGray
        return $anyDir
    }

    throw "Cannot locate index.html under $distRoot"
}

function Build-Frontend {
    param([Parameter(Mandatory)][string]$FrontendRoot)

    Write-Step "Building frontend: $(Split-Path $FrontendRoot -Leaf)"
    Push-Location $FrontendRoot
    try {
        # Step 1: Verify npm is available
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            throw "npm not found. Please install Node.js."
        }

        # Step 2: Install dependencies
        Write-Host "    Running npm ci ..." -ForegroundColor DarkGray
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed in $FrontendRoot" }
        Write-Host "    npm ci OK" -ForegroundColor Green

        # Step 3: Production build
        Write-Host "    Running npm run build --configuration production ..." -ForegroundColor DarkGray
        & npm run build -- --configuration production
        if ($LASTEXITCODE -ne 0) { throw "npm build failed in $FrontendRoot" }
        Write-Host "    Build OK" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Set-SpaWebConfig {
    param([Parameter(Mandatory)][string]$SitePath)

    # Build XML as a plain string (no here-string Unicode issues)
    $lines = @(
        '<?xml version="1.0" encoding="utf-8"?>',
        '<configuration>',
        '  <system.webServer>',
        '    <rewrite>',
        '      <rules>',
        '        <rule name="SPA Routes" stopProcessing="true">',
        '          <match url=".*" />',
        '          <conditions logicalGrouping="MatchAll">',
        '            <add input="{REQUEST_FILENAME}" matchType="IsFile"      negate="true" />',
        '            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />',
        '            <add input="{REQUEST_URI}"      pattern="^/(api)"        negate="true" />',
        '          </conditions>',
        '          <action type="Rewrite" url="/index.html" />',
        '        </rule>',
        '      </rules>',
        '    </rewrite>',
        '    <staticContent>',
        '      <remove fileExtension=".woff"  />',
        '      <remove fileExtension=".woff2" />',
        '      <mimeMap fileExtension=".woff"  mimeType="font/woff"  />',
        '      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />',
        '    </staticContent>',
        '  </system.webServer>',
        '</configuration>'
    )

    $cfgPath = Join-Path $SitePath "web.config"
    $lines | Set-Content -Path $cfgPath -Encoding UTF8
    Write-Host "    web.config written: $cfgPath" -ForegroundColor DarkGray
}

function Deploy-Frontend {
    param(
        [Parameter(Mandatory)][string]$FrontendRoot,
        [Parameter(Mandatory)][string]$SitePath,
        [switch]$Build
    )
    # Description: Deploys one Angular frontend to an IIS site folder.
    # Steps:
    #   1. Optionally run npm ci + ng build.
    #   2. Auto-rebuild if dist is missing.
    #   3. Resolve Angular output directory.
    #   4. Clean IIS site folder.
    #   5. Mirror build output to IIS site.
    #   6. Write SPA web.config.

    # Step 1: Build if requested
    if ($Build) {
        Build-Frontend -FrontendRoot $FrontendRoot
    }

    # Step 2: Auto-rebuild if dist is missing
    $distPath = Join-Path $FrontendRoot "dist"
    if (-not (Test-Path $distPath)) {
        Write-Step "dist folder missing - auto-rebuilding $(Split-Path $FrontendRoot -Leaf)"
        Build-Frontend -FrontendRoot $FrontendRoot
    }

    # Step 3: Locate the actual output folder
    $outputDir = Resolve-FrontendBuildOutput -FrontendRoot $FrontendRoot

    # Step 4: Clean IIS site folder
    if (Test-Path $SitePath) {
        Write-Step "Cleaning site folder: $SitePath"
        Get-ChildItem -LiteralPath $SitePath -Force |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Step 5: Copy files
    Write-Step "Deploying $(Split-Path $FrontendRoot -Leaf) to $SitePath"
    Invoke-RobocopyMirror -Source $outputDir -Destination $SitePath

    # Step 6: SPA routing config
    Set-SpaWebConfig -SitePath $SitePath

    Write-Host "    OK: Frontend deployed." -ForegroundColor Green
}

function Deploy-Api {
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$SitePath
    )
    # Description: Publishes ASP.NET Core API and mirrors to IIS folder.
    # Steps:
    #   1. Validate .csproj and dotnet CLI.
    #   2. Put site offline (app_offline.htm).
    #   3. dotnet publish to temp folder.
    #   4. Mirror to IIS site.
    #   5. Cleanup temp + remove app_offline.

    $csproj      = Join-Path $RepoRoot "aspnet-core\src\Elicom.Web.Host\Elicom.Web.Host.csproj"
    $tempPublish = Join-Path $env:TEMP "noshcom-api-publish"
    $offlineFile = Join-Path $SitePath "app_offline.htm"

    # Step 1: Validate
    if (-not (Test-Path $csproj)) {
        throw "API .csproj not found: $csproj"
    }
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
        throw "dotnet CLI not found. Please install .NET SDK."
    }

    Write-Step "Publishing NoshCom API"

    # Step 2: Take site offline
    New-Item -ItemType Directory -Path $SitePath -Force | Out-Null
    "Deploying - please wait" | Set-Content -Path $offlineFile -Encoding UTF8
    Start-Sleep -Seconds 2

    # Step 3+4+5
    if (Test-Path $tempPublish) {
        Remove-Item -Recurse -Force $tempPublish -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $tempPublish -Force | Out-Null

    try {
        Write-Host "    Running dotnet publish ..." -ForegroundColor DarkGray
        & dotnet publish $csproj -c Release -o $tempPublish --nologo
        if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed." }
        Write-Host "    dotnet publish OK" -ForegroundColor Green

        Invoke-RobocopyMirror -Source $tempPublish -Destination $SitePath
    } finally {
        # Always clean up temp and offline file
        if (Test-Path $tempPublish) {
            Remove-Item -Recurse -Force $tempPublish -ErrorAction SilentlyContinue
        }
        if (Test-Path $offlineFile) {
            Remove-Item $offlineFile -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "    OK: API deployed." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

Require-Admin

# Validate repo root exists
if (-not (Test-Path $RepoRoot)) {
    throw "Repo root not found: $RepoRoot (run setup-noshcom-vps.ps1 first)"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   NoshCom VPS Deploy                                     " -ForegroundColor Cyan
Write-Host "   Repo   : $RepoRoot" -ForegroundColor Cyan
Write-Host "   Branch : $Branch" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. Git pull
# ---------------------------------------------------------------------------
if (-not $SkipGitPull) {
    Write-Step "Git pull (branch: $Branch)"
    Push-Location $RepoRoot
    try {
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            throw "git not found. Install Git for Windows."
        }
        & git fetch origin $Branch
        if ($LASTEXITCODE -ne 0) { throw "git fetch failed." }
        & git pull origin $Branch
        if ($LASTEXITCODE -ne 0) { throw "git pull failed. Resolve conflicts, then rerun." }
        Write-Host "    Git pull OK" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# 2. API
# ---------------------------------------------------------------------------
if (-not $SkipApi) {
    Deploy-Api -RepoRoot $RepoRoot -SitePath $ApiSitePath
}

# ---------------------------------------------------------------------------
# 3. Frontends
# ---------------------------------------------------------------------------
if (-not $SkipFrontends) {

    # Resolve and deduplicate requested frontend keys
    $keys = @(
        $Frontends |
        ForEach-Object { $_ -split "," } |
        ForEach-Object { $_.ToLowerInvariant().Trim() } |
        Where-Object   { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object  -Unique
    )

    # Map: key -> (FrontendRoot, SitePath)
    # "eliship" is a legacy alias for "globalmart" - same target, kept so old invocations don't break.
    $frontendMap = @{
        "noshcom" = @{
            FrontendRoot = Join-Path $RepoRoot "elicom-frontend"
            SitePath     = $NoshComSitePath
        }
        "globalmart" = @{
            FrontendRoot = Join-Path $RepoRoot "Primeship"
            SitePath     = $GlobalmartSitePath
        }
        "eliship" = @{
            FrontendRoot = Join-Path $RepoRoot "Primeship"
            SitePath     = $GlobalmartSitePath
        }
    }

    foreach ($key in $keys) {
        if (-not $frontendMap.ContainsKey($key)) {
            $valid = ($frontendMap.Keys | Sort-Object) -join ", "
            throw "Unknown frontend key '$key'. Valid: $valid"
        }
        $t = $frontendMap[$key]
        if (-not (Test-Path $t.FrontendRoot)) {
            throw "Frontend root not found: $($t.FrontendRoot)"
        }
        Deploy-Frontend -FrontendRoot $t.FrontendRoot -SitePath $t.SitePath -Build:$BuildFrontends
    }
}

# ---------------------------------------------------------------------------
# 4. IIS Reset
# ---------------------------------------------------------------------------
if (-not $SkipIisReset) {
    Write-Step "Restarting IIS"
    & iisreset
    if ($LASTEXITCODE -ne 0) { throw "iisreset failed." }
    Write-Host "    IIS restarted OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   DEPLOY COMPLETE                                        " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   NoshCom    -> https://thesmartshop.uk                 " -ForegroundColor Green
Write-Host "   Globalmart -> https://globalmart.thesmartshop.uk      " -ForegroundColor Green
Write-Host "   API        -> https://api.thesmartshop.uk             " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
