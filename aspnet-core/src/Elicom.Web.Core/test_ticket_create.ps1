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

# 2. Create Ticket
$createUrl = "$base_url/services/app/SupportTicket/Create"
$ticketData = @{
    title        = "Test Ticket from PowerShell"
    message      = "This is a test ticket to verify the create API."
    priority     = "High"
    contactEmail = "noshahi@easyfinora.com"
    contactName  = "Noshahi User"
} | ConvertTo-Json

Write-Host "Creating Ticket..."
try {
    $res = Invoke-RestMethod -Uri $createUrl -Method Post -Body $ticketData -ContentType "application/json" -Headers @{ 
        "Authorization" = "Bearer $token"
        "Abp-TenantId"  = $tenantId
    }
    Write-Host "Ticket Created Successfully:"
    $res | ConvertTo-Json -Depth 5
}
catch {
    Write-Error "Create Ticket Failed: $_"
    Write-Host "Error Details: " + $_.Exception.Response
}
