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

# 2. Get All Tickets (Admin)
$getAllUrl = "$base_url/services/app/SupportTicket/GetAllTickets"
Write-Host "Fetching All Tickets..."
try {
    $res = Invoke-RestMethod -Uri $getAllUrl -Method Get -Headers @{ 
        "Authorization" = "Bearer $token"
        "Abp-TenantId"  = $tenantId
    }
    Write-Host "Tickets Found: $($res.result.totalCount)"
    $ticketId = $res.result.items[0].id
    Write-Host "First Ticket ID: $ticketId"
}
catch {
    Write-Error "Get All Tickets Failed: $_"
    exit
}

# 3. Update Status (Reply)
if ($ticketId) {
    $updateUrl = "$base_url/services/app/SupportTicket/UpdateStatus"
    $updateBody = @{
        id           = $ticketId
        status       = "Replied"
        adminRemarks = "This is an automated admin reply test."
    } | ConvertTo-Json

    Write-Host "Updating Ticket Status..."
    try {
        Invoke-RestMethod -Uri $updateUrl -Method Put -Body $updateBody -ContentType "application/json" -Headers @{ 
            "Authorization" = "Bearer $token"
            "Abp-TenantId"  = $tenantId
        }
        Write-Host "Ticket Updated Successfully."
    }
    catch {
        Write-Error "Update Status Failed: $_"
        Write-Host $_.Exception.Response
    }
}
