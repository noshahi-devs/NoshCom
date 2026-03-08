$base_url = "https://localhost:44311/api"
$user = "noshahi@easyfinora.com"
$pass = "Noshahi.000"
$tenantId = 3

# 1. Login
$loginUrl = "$base_url/TokenAuth/Authenticate"
$body = @{
    userNameOrEmailAddress = $user
    password               = $pass
    rememberClient         = $true
} | ConvertTo-Json

Write-Host "Logging in as $user..."
try {
    $response = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $body -ContentType "application/json" -Headers @{ "Abp-TenantId" = $tenantId }
    $token = $response.result.accessToken
    Write-Host "Login successful."
}
catch {
    Write-Error "Login failed: $_"
    exit
}

# 2. Get Current Login Informations
$url = "$base_url/services/app/Session/GetCurrentLoginInformations"
Write-Host "Calling $url..."

try {
    $res = Invoke-RestMethod -Uri $url -Method Get -Headers @{ 
        "Authorization" = "Bearer $token"
        "Abp-TenantId"  = $tenantId
    }
    Write-Host "User Info:"
    $res | ConvertTo-Json -Depth 5
}
catch {
    Write-Error "Call failed: $_"
}
