[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$RepoRoot = "C:\Elicom",
    [string]$Branch = "main",
    [string[]]$Frontends = @("elicom-main", "easy-finora", "primeship"),
    [switch]$SkipGitPull,
    [switch]$SkipApi,
    [switch]$SkipFrontends,
    [switch]$BuildFrontends,
    [switch]$SkipIisReset
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this script in elevated PowerShell (Run as Administrator)."
    }
}

function Invoke-RobocopyMirror {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy $Source $Destination /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
    $code = $LASTEXITCODE
    if ($code -gt 7) {
        throw "Robocopy failed. ExitCode=$code Source=$Source Destination=$Destination"
    }
}

function Resolve-FrontendBuildOutput {
    param([Parameter(Mandatory = $true)][string]$FrontendRoot)

    $distRoot = Join-Path $FrontendRoot "dist"
    if (-not (Test-Path $distRoot)) {
        throw "Build output not found: $distRoot"
    }

    $browserIndex = Get-ChildItem -Path $distRoot -Recurse -Filter index.html -File |
        Where-Object { $_.FullName -match "\\browser\\index\.html$" } |
        Select-Object -First 1

    if ($browserIndex) {
        return $browserIndex.Directory.FullName
    }

    $anyIndex = Get-ChildItem -Path $distRoot -Recurse -Filter index.html -File | Select-Object -First 1
    if ($anyIndex) {
        return $anyIndex.Directory.FullName
    }

    throw "Could not locate index.html under $distRoot"
}

function Build-Frontend {
    param([Parameter(Mandatory = $true)][string]$FrontendRoot)

    Write-Step "Building frontend: $FrontendRoot"
    Push-Location $FrontendRoot
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed in $FrontendRoot"
        }

        & npm run build -- --configuration production
        if ($LASTEXITCODE -ne 0) {
            throw "npm build failed in $FrontendRoot"
        }
    }
    finally {
        Pop-Location
    }
}

function Deploy-Api {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$SitePath
    )

    $projectPath = Join-Path $RepoRoot "aspnet-core\src\Elicom.Web.Host\Elicom.Web.Host.csproj"
    $tempPublish = "C:\deploy\publish\elicom-api"
    $offlineFile = Join-Path $SitePath "app_offline.htm"

    Write-Step "Publishing API"
    New-Item -ItemType Directory -Path $tempPublish -Force | Out-Null
    "Maintenance - updating API" | Set-Content $offlineFile -Encoding UTF8
    Start-Sleep -Seconds 2

    try {
        & dotnet publish $projectPath -c Release -o $tempPublish
        if ($LASTEXITCODE -ne 0) {
            throw "dotnet publish failed for API."
        }

        Invoke-RobocopyMirror -Source $tempPublish -Destination $SitePath
    }
    finally {
        Remove-Item $offlineFile -Force -ErrorAction SilentlyContinue
    }
}

function Deploy-FrontendSite {
    param(
        [Parameter(Mandatory = $true)][string]$FrontendRoot,
        [Parameter(Mandatory = $true)][string]$SitePath,
        [switch]$Build
    )

    if ($Build) {
        Build-Frontend -FrontendRoot $FrontendRoot
    }

    $outputDir = Resolve-FrontendBuildOutput -FrontendRoot $FrontendRoot
    Write-Step "Deploying frontend from $outputDir to $SitePath"
    Invoke-RobocopyMirror -Source $outputDir -Destination $SitePath
    Ensure-SpaWebConfig -SitePath $SitePath
}

function Ensure-SpaWebConfig {
    param([Parameter(Mandatory = $true)][string]$SitePath)

    $webConfigPath = Join-Path $SitePath "web.config"
    $webConfigContent = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
'@

    Set-Content -Path $webConfigPath -Value $webConfigContent -Encoding UTF8
}

function Get-FrontendMap {
    param([Parameter(Mandatory = $true)][string]$RepoRoot)

    return @{
        "elicom-main" = @{
            FrontendRoot = (Join-Path $RepoRoot "elicom-frontend")
            SitePath = "C:\sites\elicom-main"
        }
        "easy-finora" = @{
            FrontendRoot = (Join-Path $RepoRoot "easy-finora-frontend")
            SitePath = "C:\sites\easy-finora"
        }
        "primeship" = @{
            FrontendRoot = (Join-Path $RepoRoot "Primeship")
            SitePath = "C:\sites\primeship"
        }
    }
}

Require-Admin

if (-not (Test-Path $RepoRoot)) {
    throw "Repo root does not exist: $RepoRoot"
}

Write-Step "Deploy started (Repo=$RepoRoot, Branch=$Branch)"

Push-Location $RepoRoot
try {
    if (-not $SkipGitPull) {
        Write-Step "Pulling latest code"
        & git fetch origin $Branch
        if ($LASTEXITCODE -ne 0) {
            throw "git fetch failed."
        }
        & git pull origin $Branch
        if ($LASTEXITCODE -ne 0) {
            throw "git pull failed. Resolve local git changes, then rerun."
        }
    }
}
finally {
    Pop-Location
}

if (-not $SkipApi) {
    Deploy-Api -RepoRoot $RepoRoot -SitePath "C:\sites\elicom-api"
}

if (-not $SkipFrontends) {
    $frontendMap = Get-FrontendMap -RepoRoot $RepoRoot
    $selectedFrontends = @(
        $Frontends |
        ForEach-Object {
            # Accept both:
            # - "elicom-main,easy-finora,primeship"
            # - @("elicom-main","easy-finora","primeship")
            $_ -split ","
        } |
        ForEach-Object { $_.ToLowerInvariant().Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique
    )

    foreach ($frontendKey in $selectedFrontends) {
        if (-not $frontendMap.ContainsKey($frontendKey)) {
            $validValues = ($frontendMap.Keys | Sort-Object) -join ", "
            throw "Unknown frontend '$frontendKey'. Valid values: $validValues"
        }

        $target = $frontendMap[$frontendKey]
        Deploy-FrontendSite -FrontendRoot $target.FrontendRoot -SitePath $target.SitePath -Build:$BuildFrontends
    }
}

if (-not $SkipIisReset) {
    Write-Step "Restarting IIS"
    & iisreset
    if ($LASTEXITCODE -ne 0) {
        throw "iisreset failed."
    }
}

Write-Step "Deploy completed successfully"
