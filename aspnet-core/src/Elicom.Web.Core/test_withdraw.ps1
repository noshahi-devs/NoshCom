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
    Write-Host "Login successful. Token acquired."
}
catch {
    Write-Error "Login failed: $_"
    exit
}

# 2. Test GetMyWithdrawRequests
# I'll try 'Withdraw' first.
$endpoint = "$base_url/services/app/Withdraw/GetMyWithdrawRequests"
Write-Host "Calling $endpoint..."

try {
    $res = Invoke-RestMethod -Uri $endpoint -Method Get -Headers @{ 
        "Authorization" = "Bearer $token"
        "Abp-TenantId"  = $tenantId
    }
    Write-Host "API Response:"
    $res | ConvertTo-Json -Depth 5
}
catch {
    Write-Error "Call failed: $_"
    
    # Validation: Try 'WithdrawRequest' if 'Withdraw' failed not found (404)
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::NotFound) {
        Write-Host "Retrying with 'WithdrawRequest'..."
        $endpoint = "$base_url/services/app/WithdrawRequest/GetMyWithdrawRequests"
        try {
            $res = Invoke-RestMethod -Uri $endpoint -Method Get -Headers @{ 
                "Authorization" = "Bearer $token"
                "Abp-TenantId"  = $tenantId
            }
            Write-Host "API Response:"
            $res | ConvertTo-Json -Depth 5
        }
        catch {
            Write-Error "Call failed again: $_"
        }
    }
}
