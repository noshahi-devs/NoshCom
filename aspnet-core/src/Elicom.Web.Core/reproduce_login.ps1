$headers = @{
    "Content-Type" = "application/json"
    "Abp-TenantId" = "3"
}

$body = @{
    userNameOrEmailAddress = "noshahi@easyfinora.com"
    password = "Noshahi.000" # Testing known password
    rememberClient = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://localhost:44311/api/TokenAuth/Authenticate" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Login SUCCESS!"
    $response | Format-List
} catch {
    Write-Host "Login FAILED"
    $_.Exception.Response.GetResponseStream().StreamReader.ReadToEnd()
}
