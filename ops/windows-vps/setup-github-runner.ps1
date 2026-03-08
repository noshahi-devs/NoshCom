param(
    [Parameter(Mandatory = $true)][string]$RepoOwner,
    [Parameter(Mandatory = $true)][string]$RepoName,
    [Parameter(Mandatory = $true)][string]$GithubPat,
    [string]$RunnerName = $env:COMPUTERNAME,
    [string]$RunnerLabels = "self-hosted,windows,vps",
    [string]$InstallDir = "C:\actions-runner",
    [string]$RunnerVersion = "latest",
    [switch]$ReplaceExisting
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

function Get-RepoToken {
    param(
        [Parameter(Mandatory = $true)][string]$Owner,
        [Parameter(Mandatory = $true)][string]$Repo,
        [Parameter(Mandatory = $true)][string]$Pat,
        [Parameter(Mandatory = $true)][ValidateSet("registration-token", "remove-token")][string]$TokenType
    )

    $headers = @{
        Authorization = "Bearer $Pat"
        Accept = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
    }

    $uri = "https://api.github.com/repos/$Owner/$Repo/actions/runners/$TokenType"
    $resp = Invoke-RestMethod -Method Post -Headers $headers -Uri $uri
    return $resp.token
}

function Get-RunnerDownloadInfo {
    param([string]$Version)

    if ($Version -eq "latest") {
        $release = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/actions/runner/releases/latest"
        $asset = $release.assets | Where-Object { $_.name -match "^actions-runner-win-x64-.*\.zip$" } | Select-Object -First 1
        if (-not $asset) {
            throw "Could not find Windows x64 runner asset in latest release."
        }

        return @{
            Url = $asset.browser_download_url
            Name = $asset.name
        }
    }

    $file = "actions-runner-win-x64-$Version.zip"
    return @{
        Url = "https://github.com/actions/runner/releases/download/v$Version/$file"
        Name = $file
    }
}

Require-Admin

Write-Step "Preparing folder $InstallDir"
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

$download = Get-RunnerDownloadInfo -Version $RunnerVersion
$zipPath = Join-Path $InstallDir $download.Name

Write-Step "Downloading runner package"
Invoke-WebRequest -Uri $download.Url -OutFile $zipPath

Write-Step "Extracting runner package"
Expand-Archive -Path $zipPath -DestinationPath $InstallDir -Force

Push-Location $InstallDir
try {
    if ((Test-Path ".\.runner") -and $ReplaceExisting) {
        Write-Step "Removing existing runner configuration"
        $removeToken = Get-RepoToken -Owner $RepoOwner -Repo $RepoName -Pat $GithubPat -TokenType "remove-token"
        if (Test-Path ".\svc.cmd") {
            try { & .\svc.cmd stop | Out-Null } catch { }
            try { & .\svc.cmd uninstall | Out-Null } catch { }
        } else {
            try {
                Get-Service "actions.runner.*" -ErrorAction SilentlyContinue | ForEach-Object {
                    if ($_.Status -eq "Running") { Stop-Service $_.Name -Force -ErrorAction SilentlyContinue }
                }
            } catch { }
        }
        & .\config.cmd remove --token $removeToken | Out-Null
    }

    if ((Test-Path ".\.runner") -and -not $ReplaceExisting) {
        throw "Runner is already configured in $InstallDir. Re-run with -ReplaceExisting to replace it."
    }

    Write-Step "Requesting registration token"
    $regToken = Get-RepoToken -Owner $RepoOwner -Repo $RepoName -Pat $GithubPat -TokenType "registration-token"

    Write-Step "Configuring runner"
    $repoUrl = "https://github.com/$RepoOwner/$RepoName"
    & .\config.cmd `
        --url $repoUrl `
        --token $regToken `
        --name $RunnerName `
        --labels $RunnerLabels `
        --work "_work" `
        --unattended `
        --replace `
        --runasservice

    if ($LASTEXITCODE -ne 0) {
        throw "config.cmd failed."
    }

    $runnerServices = Get-Service "actions.runner.*" -ErrorAction SilentlyContinue
    if ($runnerServices) {
        Write-Step "Starting runner service"
        foreach ($svc in $runnerServices) {
            if ($svc.Status -ne "Running") {
                Start-Service $svc.Name
            }
        }
    }
    elseif (Test-Path ".\svc.cmd") {
        Write-Step "Installing runner as Windows service via svc.cmd"
        & .\svc.cmd install
        if ($LASTEXITCODE -ne 0) {
            throw "svc.cmd install failed."
        }

        & .\svc.cmd start
        if ($LASTEXITCODE -ne 0) {
            throw "svc.cmd start failed."
        }
    }
    else {
        Write-Step "Service helper not found; runner is configured but not installed as service"
        Write-Warning "Run '.\run.cmd' manually or re-run script with latest runner package."
    }
}
finally {
    Pop-Location
}

Write-Step "Runner setup completed"
Write-Host "Repo: https://github.com/$RepoOwner/$RepoName"
Write-Host "Runner: $RunnerName"
Write-Host "Labels: $RunnerLabels"
