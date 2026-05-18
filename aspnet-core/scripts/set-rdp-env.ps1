[CmdletBinding(DefaultParameterSetName = "Apply")]
param(
    [Parameter(ParameterSetName = "Apply", Mandatory = $true)] [string]$DbConnection,
    [Parameter(ParameterSetName = "Apply", Mandatory = $true)] [string]$JwtSecurityKey,
    [Parameter(ParameterSetName = "Apply", Mandatory = $true)] [string]$SeedDefaultPassword,
    [Parameter(ParameterSetName = "Apply", Mandatory = $false)] [string]$SwaggerUsername,
    [Parameter(ParameterSetName = "Apply", Mandatory = $false)] [string]$SwaggerPassword,

    [Parameter(ParameterSetName = "Apply", Mandatory = $false)] [string]$SmtpHost,
    [Parameter(ParameterSetName = "Apply", Mandatory = $false)] [string]$SmtpPort = "587",
    [Parameter(ParameterSetName = "Apply", Mandatory = $false)] [string]$SmtpUsername,
    [Parameter(ParameterSetName = "Apply", Mandatory = $false)] [string]$SmtpPassword,

    [Parameter(ParameterSetName = "UpdateDbPassword", Mandatory = $true)] [securestring]$DbPassword,
    [Parameter(ParameterSetName = "UpdateDbPassword", Mandatory = $false)] [string]$AppSettingsPath,

    [Parameter(ParameterSetName = "VerifyOnly", Mandatory = $true)] [switch]$VerifyOnly
)

$machine = [System.EnvironmentVariableTarget]::Machine

function Set-MachineVar {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$Value
    )

    [System.Environment]::SetEnvironmentVariable($Name, $Value, $machine)
}

function Get-MachineVar {
    param([Parameter(Mandatory = $true)] [string]$Name)
    return [System.Environment]::GetEnvironmentVariable($Name, $machine)
}

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
    foreach ($key in @("password", "pwd", "user id", "uid")) {
        if ($builder.ContainsKey($key)) {
            $builder[$key] = "*****"
        }
    }
    return $builder.ToString()
}

function Get-ExistingDbConnectionString {
    param([string]$AppSettingsPath)

    foreach ($name in @("ConnectionStrings__DefaultConnection", "ConnectionStrings__Default", "ELICOM_DB_CONNECTION_STRING")) {
        $value = Get-MachineVar -Name $name
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }

    $candidatePaths = @()
    if (-not [string]::IsNullOrWhiteSpace($AppSettingsPath)) {
        $candidatePaths += $AppSettingsPath
    }

    $candidatePaths += (Join-Path $PSScriptRoot "..\src\Elicom.Web.Host\appsettings.json")

    foreach ($path in $candidatePaths) {
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }

        $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $cs = $json.ConnectionStrings.DefaultConnection
        if ([string]::IsNullOrWhiteSpace($cs)) {
            $cs = $json.ConnectionStrings.Default
        }

        if (-not [string]::IsNullOrWhiteSpace($cs)) {
            return $cs
        }
    }

    return $null
}

function Update-ConnectionStringPassword {
    param(
        [Parameter(Mandatory = $true)] [string]$ConnectionString,
        [Parameter(Mandatory = $true)] [string]$NewPassword
    )

    $builder = New-Object System.Data.Common.DbConnectionStringBuilder
    $builder.ConnectionString = $ConnectionString

    if ($builder.ContainsKey("Password")) {
        $builder["Password"] = $NewPassword
    }
    elseif ($builder.ContainsKey("Pwd")) {
        $builder["Pwd"] = $NewPassword
    }
    else {
        $builder.Add("Password", $NewPassword)
    }

    return $builder.ConnectionString
}

function Test-RequiredVars {
    param(
        [string[]]$Required = @(
            "ConnectionStrings__Default",
            "ConnectionStrings__DefaultConnection",
            "Authentication__JwtBearer__SecurityKey",
            "ELICOM_SEED_DEFAULT_PASSWORD",
            "ELICOM_DB_CONNECTION_STRING"
        )
    )

    $failed = @()
    foreach ($name in $Required) {
        $value = Get-MachineVar -Name $name
        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Host "[MISSING] $name" -ForegroundColor Red
            $failed += $name
        }
        else {
            Write-Host "[OK]      $name" -ForegroundColor Green
        }
    }

    if ($failed.Count -eq 0) {
        Write-Host ""
        Write-Host "Verification PASSED: all required environment variables exist." -ForegroundColor Green
        return $true
    }

    Write-Host ""
    Write-Host "Verification FAILED: missing required variables." -ForegroundColor Red
    return $false
}

if ($PSCmdlet.ParameterSetName -eq "UpdateDbPassword") {
    $existing = Get-ExistingDbConnectionString -AppSettingsPath $AppSettingsPath
    if ([string]::IsNullOrWhiteSpace($existing)) {
        Write-Host "[MISSING] Existing connection string not found in Machine env or appsettings.json" -ForegroundColor Red
        Write-Host "Checked: ConnectionStrings__DefaultConnection, ConnectionStrings__Default, ELICOM_DB_CONNECTION_STRING" -ForegroundColor Yellow
        Write-Host "Tip: pass -AppSettingsPath \"C:\\path\\to\\appsettings.json\"" -ForegroundColor Yellow
        exit 1
    }

    $plainPwd = ConvertTo-PlainText -Value $DbPassword
    $updatedCs = Update-ConnectionStringPassword -ConnectionString $existing -NewPassword $plainPwd

    Set-MachineVar -Name "ConnectionStrings__Default" -Value $updatedCs
    Set-MachineVar -Name "ConnectionStrings__DefaultConnection" -Value $updatedCs
    Set-MachineVar -Name "ELICOM_DB_CONNECTION_STRING" -Value $updatedCs

    Write-Host "Database connection string updated on machine scope (password masked below):" -ForegroundColor Cyan
    Write-Host (Mask-ConnectionString -ConnectionString $updatedCs) -ForegroundColor DarkGray
    Write-Host ""

    $ok = Test-RequiredVars -Required @("ConnectionStrings__Default", "ConnectionStrings__DefaultConnection", "ELICOM_DB_CONNECTION_STRING")
    if (-not $ok) {
        exit 1
    }

    Write-Host ""
    Write-Host "Next: restart IIS/app pool and backend services so new vars are loaded." -ForegroundColor Yellow
    exit 0
}

if (-not $VerifyOnly) {
    Set-MachineVar -Name "ConnectionStrings__Default" -Value $DbConnection
    Set-MachineVar -Name "ConnectionStrings__DefaultConnection" -Value $DbConnection
    Set-MachineVar -Name "Authentication__JwtBearer__SecurityKey" -Value $JwtSecurityKey
    Set-MachineVar -Name "ELICOM_SEED_DEFAULT_PASSWORD" -Value $SeedDefaultPassword
    if (-not [string]::IsNullOrWhiteSpace($SwaggerUsername)) {
        Set-MachineVar -Name "ELICOM_SWAGGER_BASIC_AUTH_USERNAME" -Value $SwaggerUsername
    }

    if (-not [string]::IsNullOrWhiteSpace($SwaggerPassword)) {
        Set-MachineVar -Name "ELICOM_SWAGGER_BASIC_AUTH_PASSWORD" -Value $SwaggerPassword
    }
    Set-MachineVar -Name "ELICOM_DB_CONNECTION_STRING" -Value $DbConnection

    if (-not [string]::IsNullOrWhiteSpace($SmtpHost)) {
        Set-MachineVar -Name "Settings__Abp.Net.Mail.Smtp.Host" -Value $SmtpHost
        Set-MachineVar -Name "EmailSettings__SmtpHost" -Value $SmtpHost
    }

    if (-not [string]::IsNullOrWhiteSpace($SmtpPort)) {
        Set-MachineVar -Name "Settings__Abp.Net.Mail.Smtp.Port" -Value $SmtpPort
        Set-MachineVar -Name "EmailSettings__Port" -Value $SmtpPort
    }

    if (-not [string]::IsNullOrWhiteSpace($SmtpUsername)) {
        Set-MachineVar -Name "Settings__Abp.Net.Mail.Smtp.UserName" -Value $SmtpUsername
        Set-MachineVar -Name "EmailSettings__Username" -Value $SmtpUsername
    }

    if (-not [string]::IsNullOrWhiteSpace($SmtpPassword)) {
        Set-MachineVar -Name "Settings__Abp.Net.Mail.Smtp.Password" -Value $SmtpPassword
        Set-MachineVar -Name "EmailSettings__Password" -Value $SmtpPassword
    }

    Write-Host "Environment variables updated on machine scope." -ForegroundColor Cyan
    Write-Host ""
}

$ok = Test-RequiredVars
if (-not $ok) {
    exit 1
}

Write-Host ""
Write-Host "Next: restart IIS/app pool and backend services so new vars are loaded." -ForegroundColor Yellow
