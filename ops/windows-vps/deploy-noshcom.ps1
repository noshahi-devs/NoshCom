#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Deploy NoshCom, Eliship (Primeship) frontends + NoshCom API to the new VPS.
    Does NOT touch easy-finora or any other existing project on this server.

.EXAMPLES
    # Full deploy (git pull + build frontends + publish API + iisreset)
    .\deploy-noshcom.ps1 -BuildFrontends

    # Deploy only frontends, skip API and git pull
    .\deploy-noshcom.ps1 -SkipApi -SkipGitPull -BuildFrontends

    # Deploy only API
    .\deploy-noshcom.ps1 -SkipFrontends

    # Deploy only NoshCom frontend
    .\deploy-noshcom.ps1 -Frontends noshcom -BuildFrontends

    # Quick redeploy after manual git pull (no rebuild)
    .\deploy-noshcom.ps1 -SkipGitPull -SkipApi
#>

[CmdletBinding(PositionalBinding = $false)]
param(
    # Repo location on this VPS
    [string]$RepoRoot = "C:\GitHub Projects\NoshCom",
    [string]$Branch   = "main",

    # Which frontends to deploy  (noshcom | eliship | both)
    [string[]]$Frontends = @("noshcom", "eliship"),

    # IIS site paths  (must match what setup-noshcom-vps.ps1 created)
    [string]$NoshComSitePath = "C:\sites\noshcom",
    [string]$ElishipSitePath = "C:\sites\eliship",
    [string]$ApiSitePath     = "C:\sites\noshcom-api",

    # Switches
    [switch]$SkipGitPull,
    [switch]$SkipApi,
    [switch]$SkipFrontends,
    [switch]$BuildFrontends,   # pass this to run npm ci + ng build
    [switch]$SkipIisReset
)

$ErrorActionPreference = "Stop"

# ─── helpers ────────────────────────────────────────────────────────────────
function Write-Step { param([string]$m) Write-Host "`n==> $m" -ForegroundColor Cyan }

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
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy $Source $Destination /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -gt 7) {
        throw "Robocopy failed. ExitCode=$LASTEXITCODE  Src=$Source  Dst=$Destination"
    }
}

function Resolve-FrontendBuildOutput {
    param([Parameter(Mandatory)][string]$FrontendRoot)
    $distRoot = Join-Path $FrontendRoot "dist"
    if (-not (Test-Path $distRoot)) { throw "dist/ not found. Did you build? ($distRoot)" }

    # Prefer …/dist/<name>/browser/index.html  (Angular 17+ output)
    $browserDir = Get-ChildItem -Path $distRoot -Recurse -Filter index.html -File |
                  Where-Object { $_.FullName -match "\\browser\\index\.html$" } |
                  Select-Object -First 1 |
                  ForEach-Object { $_.Directory.FullName }
    if ($browserDir) { return $browserDir }

    # Fallback: any index.html
    $anyDir = Get-ChildItem -Path $distRoot -Recurse -Filter index.html -File |
              Select-Object -First 1 |
              ForEach-Object { $_.Directory.FullName }
    if ($anyDir) { return $anyDir }

    throw "Cannot find index.html under $distRoot"
}

function Build-Frontend {
    param([Parameter(Mandatory)][string]$FrontendRoot)
    Write-Step "Building frontend: $(Split-Path $FrontendRoot -Leaf)"
    Push-Location $FrontendRoot
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed in $FrontendRoot" }
        & npm run build -- --configuration production
        if ($LASTEXITCODE -ne 0) { throw "npm build failed in $FrontendRoot" }
    } finally {
        Pop-Location
    }
}

function Set-SpaWebConfig {
    param([Parameter(Mandatory)][string]$SitePath)
    $cfg = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile"      negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory"  negate="true" />
            <add input="{REQUEST_URI}"      pattern="^/(api)"        negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".woff"  />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff"  mimeType="font/woff"  />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
</configuration>
'@
    Set-Content -Path (Join-Path $SitePath "web.config") -Value $cfg -Encoding UTF8
}

function Deploy-Frontend {
    param(
        [Parameter(Mandatory)][string]$FrontendRoot,
        [Parameter(Mandatory)][string]$SitePath,
        [switch]$Build
    )
    if ($Build) { Build-Frontend -FrontendRoot $FrontendRoot }
    $outputDir = Resolve-FrontendBuildOutput -FrontendRoot $FrontendRoot
    Write-Step "Copying $(Split-Path $FrontendRoot -Leaf) → $SitePath"
    Invoke-RobocopyMirror -Source $outputDir -Destination $SitePath
    Set-SpaWebConfig -SitePath $SitePath
    Write-Host "    OK: Frontend deployed." -ForegroundColor Green
}

function Deploy-Api {
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$SitePath
    )
    $csproj      = Join-Path $RepoRoot "aspnet-core\src\Elicom.Web.Host\Elicom.Web.Host.csproj"
    $tempPublish = "C:\deploy\publish\noshcom-api"
    $offlineFile = Join-Path $SitePath "app_offline.htm"

    if (-not (Test-Path $csproj)) { throw "API .csproj not found: $csproj" }

    Write-Step "Publishing NoshCom API"
    New-Item -ItemType Directory -Path $tempPublish -Force | Out-Null
    "Maintenance — deploying new API build" | Set-Content $offlineFile -Encoding UTF8
    Start-Sleep -Seconds 2

    try {
        & dotnet publish $csproj -c Release -o $tempPublish --nologo
        if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed." }
        Invoke-RobocopyMirror -Source $tempPublish -Destination $SitePath
    } finally {
        Remove-Item $offlineFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host "    OK: API deployed." -ForegroundColor Green
}

# ────────────────────────────────────────────────────────────────────────────
#  MAIN
# ────────────────────────────────────────────────────────────────────────────
Require-Admin

if (-not (Test-Path $RepoRoot)) {
    throw "Repo root not found: $RepoRoot  (run setup-noshcom-vps.ps1 first)"
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   NoshCom VPS Deploy                                    ║" -ForegroundColor Cyan
Write-Host "║   Repo : $RepoRoot" -ForegroundColor Cyan
Write-Host "║   Branch: $Branch" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── 1. Git pull ──────────────────────────────────────────────────────────────
if (-not $SkipGitPull) {
    Write-Step "Git pull (branch: $Branch)"
    Push-Location $RepoRoot
    try {
        & git fetch origin $Branch
        if ($LASTEXITCODE -ne 0) { throw "git fetch failed." }
        & git pull origin $Branch
        if ($LASTEXITCODE -ne 0) { throw "git pull failed. Resolve conflicts, then rerun." }
    } finally {
        Pop-Location
    }
}

# ── 2. API ───────────────────────────────────────────────────────────────────
if (-not $SkipApi) {
    Deploy-Api -RepoRoot $RepoRoot -SitePath $ApiSitePath
}

# ── 3. Frontends ─────────────────────────────────────────────────────────────
if (-not $SkipFrontends) {

    # Resolve and deduplicate requested frontend keys
    $keys = @(
        $Frontends |
        ForEach-Object { $_ -split "," } |
        ForEach-Object { $_.ToLowerInvariant().Trim() } |
        Where-Object   { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique
    )

    # Map key → (FrontendRoot, SitePath)
    $frontendMap = @{
        "noshcom" = @{
            FrontendRoot = (Join-Path $RepoRoot "elicom-frontend")
            SitePath     = $NoshComSitePath
        }
        "eliship" = @{
            FrontendRoot = (Join-Path $RepoRoot "Primeship")
            SitePath     = $ElishipSitePath
        }
    }

    foreach ($key in $keys) {
        if (-not $frontendMap.ContainsKey($key)) {
            $valid = ($frontendMap.Keys | Sort-Object) -join ", "
            throw "Unknown frontend key '$key'. Valid: $valid"
        }
        $t = $frontendMap[$key]
        Deploy-Frontend -FrontendRoot $t.FrontendRoot -SitePath $t.SitePath -Build:$BuildFrontends
    }
}

# ── 4. IIS Reset ─────────────────────────────────────────────────────────────
if (-not $SkipIisReset) {
    Write-Step "Restarting IIS"
    & iisreset
    if ($LASTEXITCODE -ne 0) { throw "iisreset failed." }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   DEPLOY COMPLETE                                        ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║   NoshCom   → http://YOUR-VPS-IP:8083                   ║" -ForegroundColor Green
Write-Host "║   Eliship   → http://YOUR-VPS-IP:8084                   ║" -ForegroundColor Green
Write-Host "║   API       → http://YOUR-VPS-IP:8085                   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
