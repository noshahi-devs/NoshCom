#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-time setup for NoshCom on a new Windows VPS.
    Creates IIS sites for: NoshCom (elicom-frontend), Eliship (Primeship), NoshCom-API (aspnet-core).

.USAGE
    Run ONCE on the new VPS in elevated PowerShell:
        .\setup-noshcom-vps.ps1

    To customise ports or paths:
        .\setup-noshcom-vps.ps1 -ApiPort 5000 -NoshComPort 8080 -ElishipPort 8081
#>

[CmdletBinding(PositionalBinding = $false)]
param(
    # Where the repo will be cloned (parent folder must already exist)
    [string]$RepoParent   = "C:\GitHub Projects",
    [string]$RepoName     = "NoshCom",

    # IIS site root folders (created automatically)
    [string]$NoshComSitePath = "C:\sites\noshcom",
    [string]$ElishipSitePath = "C:\sites\eliship",
    [string]$ApiSitePath     = "C:\sites\noshcom-api",

    # Ports  (8080 is HomeFilla-WEB, so we start at 8083)
    [int]$NoshComPort = 8083,
    [int]$ElishipPort = 8084,
    [int]$ApiPort     = 8085,

    # GitHub repo URL
    [string]$RepoUrl  = "https://github.com/noshahi-devs/NoshCom.git",
    [string]$Branch   = "main",

    # Set to $true to skip git clone (if you cloned manually)
    [switch]$SkipClone
)

$ErrorActionPreference = "Stop"

# ─── helpers ────────────────────────────────────────────────────────────────
function Write-Step { param([string]$m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok   { param([string]$m) Write-Host "    OK: $m" -ForegroundColor Green }
function Write-Warn { param([string]$m) Write-Host "    WARN: $m" -ForegroundColor Yellow }

# ─── Import WebAdministration ────────────────────────────────────────────────
Import-Module WebAdministration -ErrorAction Stop

$RepoRoot = Join-Path $RepoParent $RepoName

# ────────────────────────────────────────────────────────────────────────────
# 1. Clone repository
# ────────────────────────────────────────────────────────────────────────────
Write-Step "Cloning repository"

if (-not $SkipClone) {
    if (Test-Path $RepoRoot) {
        Write-Warn "Folder already exists: $RepoRoot  (skipping clone, will git pull instead)"
        Push-Location $RepoRoot
        & git pull origin $Branch
        Pop-Location
    } else {
        New-Item -ItemType Directory -Path $RepoParent -Force | Out-Null
        & git clone --branch $Branch $RepoUrl $RepoRoot
        if ($LASTEXITCODE -ne 0) { throw "git clone failed." }
    }
    Write-Ok "Repo ready at $RepoRoot"
} else {
    Write-Warn "Skipping git clone (SkipClone flag set). Expecting repo at: $RepoRoot"
    if (-not (Test-Path $RepoRoot)) { throw "Repo folder not found: $RepoRoot" }
}

# ────────────────────────────────────────────────────────────────────────────
# 2. Create site folders
# ────────────────────────────────────────────────────────────────────────────
Write-Step "Creating site root folders"

foreach ($path in @($NoshComSitePath, $ElishipSitePath, $ApiSitePath)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    Write-Ok $path
}

# ────────────────────────────────────────────────────────────────────────────
# 3. Create IIS Application Pools
# ────────────────────────────────────────────────────────────────────────────
Write-Step "Creating IIS Application Pools"

$pools = @(
    @{ Name = "NoshCom";     Mode = "Integrated"; Runtime = "v4.0" }
    @{ Name = "Eliship";     Mode = "Integrated"; Runtime = "v4.0" }
    @{ Name = "NoshCom-API"; Mode = "Integrated"; Runtime = "v4.0" }
)

foreach ($p in $pools) {
    $poolPath = "IIS:\AppPools\$($p.Name)"
    if (Test-Path $poolPath) {
        Write-Warn "App pool '$($p.Name)' already exists — skipping."
    } else {
        New-Item $poolPath | Out-Null
        Set-ItemProperty $poolPath -Name managedRuntimeVersion -Value "No Managed Code"
        Set-ItemProperty $poolPath -Name managedPipelineMode   -Value "Integrated"
        Set-ItemProperty $poolPath -Name startMode             -Value "AlwaysRunning"
        Write-Ok "App pool created: $($p.Name)"
    }
}

# ────────────────────────────────────────────────────────────────────────────
# 4. Create IIS Sites
# ────────────────────────────────────────────────────────────────────────────
Write-Step "Creating IIS Sites"

$sites = @(
    @{ Name = "NoshCom";     Pool = "NoshCom";     Path = $NoshComSitePath; Port = $NoshComPort }
    @{ Name = "Eliship";     Pool = "Eliship";     Path = $ElishipSitePath; Port = $ElishipPort }
    @{ Name = "NoshCom-API"; Pool = "NoshCom-API"; Path = $ApiSitePath;     Port = $ApiPort    }
)

foreach ($s in $sites) {
    if (Get-Website -Name $s.Name -ErrorAction SilentlyContinue) {
        Write-Warn "IIS site '$($s.Name)' already exists — skipping."
    } else {
        New-Website -Name $s.Name `
                    -ApplicationPool $s.Pool `
                    -PhysicalPath $s.Path `
                    -Port $s.Port `
                    -Force | Out-Null
        Write-Ok "IIS site created: $($s.Name)  http://localhost:$($s.Port)"
    }
}

# ────────────────────────────────────────────────────────────────────────────
# 5. Set folder permissions (IIS_IUSRS + IUSR)
# ────────────────────────────────────────────────────────────────────────────
Write-Step "Setting folder permissions"

$grantPaths = @($NoshComSitePath, $ElishipSitePath, $ApiSitePath)
$accounts   = @("IIS_IUSRS", "IUSR")

foreach ($path in $grantPaths) {
    foreach ($acct in $accounts) {
        & icacls $path /grant "${acct}:(OI)(CI)RX" /T /Q
        if ($LASTEXITCODE -ne 0) { Write-Warn "icacls may have had minor issues for $acct on $path" }
    }
    # App pool identity needs Modify on API path for log/temp writes
    if ($path -eq $ApiSitePath) {
        & icacls $path /grant "IIS AppPool\NoshCom-API:(OI)(CI)M" /T /Q
    }
    Write-Ok "Permissions set on $path"
}

# Also grant read on the repo root so IIS can serve from dist during initial test
& icacls $RepoRoot /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q | Out-Null

# ────────────────────────────────────────────────────────────────────────────
# 6. Summary
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           SETUP COMPLETE — NoshCom VPS                  ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Site          Port                                      ║" -ForegroundColor Green
Write-Host "║  NoshCom       :$NoshComPort   → $NoshComSitePath" -ForegroundColor Green
Write-Host "║  Eliship       :$ElishipPort   → $ElishipSitePath" -ForegroundColor Green
Write-Host "║  NoshCom-API   :$ApiPort   → $ApiSitePath" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Repo: $RepoRoot" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next step → run deploy-noshcom.ps1 to build & copy files." -ForegroundColor Yellow
