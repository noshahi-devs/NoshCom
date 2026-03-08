# Brevo SMTP Integration (Transactional Email)

## Objective
Send transactional emails (registration verification and password reset) via Brevo SMTP for:
- `no-reply@worldcartus.com`
- `no-reply@easyfinora.com`
- `no-reply@primeshipuk.com`

## SMTP Settings
- Host: `smtp-relay.brevo.com`
- Port: `587`
- Encryption: `TLS` (`EnableSsl=true`)
- Username: Brevo SMTP login
- Password: Brevo SMTP key

## App Configuration
`appsettings.json` and `appsettings.Staging.json` now include:

```json
"EmailSettings": {
  "SmtpHost": "smtp-relay.brevo.com",
  "Port": 587,
  "EnableSsl": true,
  "Username": "",
  "Password": ""
}
```

## Recommended Production Secrets (IIS/App Service Environment Variables)
Use environment variables instead of file secrets:
- `BREVO_SMTP_USERNAME`
- `BREVO_SMTP_PASSWORD`

Optional ABP-compatible keys (also supported):
- `Settings__Abp.Net.Mail.Smtp.Host`
- `Settings__Abp.Net.Mail.Smtp.Port`
- `Settings__Abp.Net.Mail.Smtp.UserName`
- `Settings__Abp.Net.Mail.Smtp.Password`

## Code Path Updated
Signup verification and password-reset email sending flow now uses SMTP resolution from:
1. Method arguments
2. `EmailSettings:*`
3. `Settings:Abp.Net.Mail.*`
4. `BREVO_SMTP_USERNAME` / `BREVO_SMTP_PASSWORD`

Main file:
- `src/Elicom.Application/Authorization/Accounts/AccountAppService.cs`

## Platform Sender Mapping
Sender address is selected by platform:
- World Cart/Default -> `no-reply@worldcartus.com`
- Easy Finora -> `no-reply@easyfinora.com`
- Prime Ship -> `no-reply@primeshipuk.com`

## Test Checklist
1. Register a user on each platform and confirm verification email is delivered.
2. Run forgot password flow and confirm reset email is delivered.
3. Validate email headers show expected `From` domain.
4. Validate logs include success/failure entries with recipient and subject.

## DNS/Deliverability Requirements
Before production:
- Verify sender domains in Brevo.
- Configure SPF/DKIM/Brevo verification records.
- Confirm domain reputation and spam score.

## Security Notes
- Do not commit SMTP keys.
- Rotate keys immediately if exposed.
