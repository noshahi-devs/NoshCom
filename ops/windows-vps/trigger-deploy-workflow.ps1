param(
    [Parameter(Mandatory = $true)][string]$RepoOwner,
    [Parameter(Mandatory = $true)][string]$RepoName,
    [Parameter(Mandatory = $true)][string]$GithubPat,
    [string]$Ref = "main",
    [bool]$DeployApi = $true,
    [bool]$DeployFrontends = $true,
    [string]$Frontends = "elicom-main,easy-finora,primeship",
    [bool]$BuildFrontends = $false
)

$ErrorActionPreference = "Stop"

$headers = @{
    Authorization = "Bearer $GithubPat"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$body = @{
    ref = $Ref
    inputs = @{
        deploy_api = "$DeployApi".ToLowerInvariant()
        deploy_frontends = "$DeployFrontends".ToLowerInvariant()
        frontends = $Frontends
        build_frontends = "$BuildFrontends".ToLowerInvariant()
    }
} | ConvertTo-Json -Depth 5

$uri = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/workflows/deploy-vps.yml/dispatches"
Invoke-RestMethod -Method Post -Headers $headers -Uri $uri -Body $body -ContentType "application/json"

Write-Host "Workflow dispatch sent successfully."
