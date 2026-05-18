[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [securestring]$NewPassword,

    [Parameter(Mandatory = $false)]
    [string]$DbUser = "elicom_app",

    [Parameter(Mandatory = $false)]
    [string]$RepoRoot = "C:\\Elicom",

    [Parameter(Mandatory = $false)]
    [switch]$SetMachineEnv
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function ConvertTo-PlainText {
    param([Parameter(Mandatory = $true)] [securestring]$Value)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Mask-ConnectionString {
    param([Parameter(Mandatory = $true)] [string]$ConnectionString)

    $builder = New-Object System.Data.Common.DbConnectionStringBuilder
    $builder.ConnectionString = $ConnectionString
    foreach ($key in @("password", "pwd")) {
        if ($builder.ContainsKey($key)) {
            $builder[$key] = "*****"
        }
    }
    return $builder.ToString()
}

function Update-ConnectionStringPassword {
    param(
        [Parameter(Mandatory = $true)] [string]$ConnectionString,
        [Parameter(Mandatory = $true)] [string]$NewPasswordText,
        [Parameter(Mandatory = $true)] [string]$DbUser
    )

    $builder = New-Object System.Data.Common.DbConnectionStringBuilder
    $builder.ConnectionString = $ConnectionString

    $userMatches = $false
    foreach ($key in @("User ID", "User Id", "UID", "Uid", "uid")) {
        if ($builder.ContainsKey($key) -and ($builder[$key].ToString() -eq $DbUser)) {
            $userMatches = $true
            break
        }
    }

    if (-not $userMatches) {
        return $null
    }

    if ($builder.ContainsKey("Password")) {
        $builder["Password"] = $NewPasswordText
    }
    elseif ($builder.ContainsKey("Pwd")) {
        $builder["Pwd"] = $NewPasswordText
    }
    else {
        $builder.Add("Password", $NewPasswordText)
    }

    return $builder.ConnectionString
}

function Update-AppSettingsJson {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$NewPasswordText,
        [Parameter(Mandatory = $true)] [string]$DbUser
    )

    $raw = Get-Content -LiteralPath $Path -Raw
    $json = $raw | ConvertFrom-Json
    if ($null -eq $json.ConnectionStrings) {
        return $false
    }

    $changed = $false
    foreach ($name in @("DefaultConnection", "Default")) {
        $existing = $json.ConnectionStrings.$name
        if ([string]::IsNullOrWhiteSpace($existing)) {
            continue
        }

        $updated = Update-ConnectionStringPassword -ConnectionString $existing -NewPasswordText $NewPasswordText -DbUser $DbUser
        if ($null -ne $updated -and $updated -ne $existing) {
            $json.ConnectionStrings.$name = $updated
            $changed = $true
        }
    }

    if (-not $changed) {
        return $false
    }

    $json | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Path -Encoding UTF8
    return $true
}

function Update-LaunchSettingsJson {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$NewPasswordText,
        [Parameter(Mandatory = $true)] [string]$DbUser
    )

    $raw = Get-Content -LiteralPath $Path -Raw
    $json = $raw | ConvertFrom-Json
    if ($null -eq $json.profiles) {
        return $false
    }

    $changed = $false
    foreach ($profileName in $json.profiles.PSObject.Properties.Name) {
        $profile = $json.profiles.$profileName
        if ($null -eq $profile.environmentVariables) {
            continue
        }

        foreach ($envKey in @("ConnectionStrings__DefaultConnection", "ConnectionStrings__Default")) {
            $existing = $profile.environmentVariables.$envKey
            if ([string]::IsNullOrWhiteSpace($existing)) {
                continue
            }

            $updated = Update-ConnectionStringPassword -ConnectionString $existing -NewPasswordText $NewPasswordText -DbUser $DbUser
            if ($null -ne $updated -and $updated -ne $existing) {
                $profile.environmentVariables.$envKey = $updated
                $changed = $true
            }
        }
    }

    if (-not $changed) {
        return $false
    }

    $json | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Path -Encoding UTF8
    return $true
}

function Update-DockerComposeYml {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$NewPasswordText
    )

    $content = Get-Content -LiteralPath $Path -Raw

    # Only touch values for keys like ConnectionStrings__Default / DefaultConnection inside quotes
    $pattern = '(ConnectionStrings__Default(Connection)?\s*:\s*")([^"]*)(")'
    $changed = $false

    $updatedContent = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        $pattern,
        {
            param($m)
            $cs = $m.Groups[3].Value
            try {
                $builder = New-Object System.Data.Common.DbConnectionStringBuilder
                $builder.ConnectionString = $cs
                if ($builder.ContainsKey("Password")) { $builder["Password"] = $NewPasswordText }
                elseif ($builder.ContainsKey("Pwd")) { $builder["Pwd"] = $NewPasswordText }
                else { $builder.Add("Password", $NewPasswordText) }
                $changed = $true
                return $m.Groups[1].Value + $builder.ConnectionString + $m.Groups[4].Value
            }
            catch {
                return $m.Value
            }
        }
    )

    if (-not $changed) {
        return $false
    }

    Set-Content -LiteralPath $Path -Value $updatedContent -Encoding UTF8
    return $true
}

$plainPwd = ConvertTo-PlainText -Value $NewPassword

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    throw "RepoRoot not found: $RepoRoot"
}

$updatedFiles = New-Object System.Collections.Generic.List[string]

$appsettingsFiles = Get-ChildItem -Path $RepoRoot -Recurse -Filter "appsettings*.json" -File -ErrorAction SilentlyContinue
foreach ($file in $appsettingsFiles) {
    if (Update-AppSettingsJson -Path $file.FullName -NewPasswordText $plainPwd -DbUser $DbUser) {
        $updatedFiles.Add($file.FullName) | Out-Null
    }
}

$launchSettingsFiles = Get-ChildItem -Path $RepoRoot -Recurse -Filter "launchSettings.json" -File -ErrorAction SilentlyContinue
foreach ($file in $launchSettingsFiles) {
    if (Update-LaunchSettingsJson -Path $file.FullName -NewPasswordText $plainPwd -DbUser $DbUser) {
        $updatedFiles.Add($file.FullName) | Out-Null
    }
}

$dockerComposeFiles = Get-ChildItem -Path $RepoRoot -Recurse -Filter "docker-compose*.yml" -File -ErrorAction SilentlyContinue
foreach ($file in $dockerComposeFiles) {
    if (Update-DockerComposeYml -Path $file.FullName -NewPasswordText $plainPwd) {
        $updatedFiles.Add($file.FullName) | Out-Null
    }
}

if ($SetMachineEnv) {
    $webHostSettings = Join-Path $RepoRoot "aspnet-core\\src\\Elicom.Web.Host\\appsettings.json"
    if (Test-Path -LiteralPath $webHostSettings) {
        $json = Get-Content -LiteralPath $webHostSettings -Raw | ConvertFrom-Json
        $cs = $json.ConnectionStrings.DefaultConnection
        if ([string]::IsNullOrWhiteSpace($cs)) { $cs = $json.ConnectionStrings.Default }
        if (-not [string]::IsNullOrWhiteSpace($cs)) {
            [Environment]::SetEnvironmentVariable("ConnectionStrings__DefaultConnection", $cs, "Machine")
            [Environment]::SetEnvironmentVariable("ConnectionStrings__Default", $cs, "Machine")
            [Environment]::SetEnvironmentVariable("ELICOM_DB_CONNECTION_STRING", $cs, "Machine")
        }
    }
}

Write-Host "Updated files:" -ForegroundColor Cyan
if ($updatedFiles.Count -eq 0) {
    Write-Host "  (none found/changed)" -ForegroundColor Yellow
}
else {
    foreach ($f in $updatedFiles) {
        Write-Host "  $f" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "IMPORTANT: avoid committing secrets. Prefer Machine env vars for production." -ForegroundColor Yellow
Write-Host "Restart IIS/app pool/service after updating." -ForegroundColor Yellow

