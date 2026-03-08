# Elicom Deployment Handoff (Windows VPS + IIS)

## 1) Scope
This runbook is for deploying and operating:
- API: `Elicom.Web.Host` on IIS
- Frontends:
  - `elicom-frontend` -> `worldcartus.com`
  - `easy-finora-frontend` -> `easyfinora.com`
  - `Primeship` -> `primeshipuk.com`

Current API public host:
- `https://api.worldcartus.com`

---

## 2) Current Architecture
- OS: Windows Server (IIS)
- Runtime: .NET 8
- API site path: `C:\sites\elicom-api`
- Frontend site paths:
  - `C:\sites\elicom-main`
  - `C:\sites\easy-finora`
  - `C:\sites\primeship`
- DB: SQL Server (localhost)
- API app pool: `elicom-api-pool`
- File storage: local disk (not Azure Blob), served at:
  - physical root: `C:\data\uploads`
  - public URL prefix: `/uploads`
  - example URL: `https://api.worldcartus.com/uploads/primeship-products/<file>`

---

## 3) Important Scripts
- Deploy script: `ops/windows-vps/deploy-all.ps1`
- Runner setup: `ops/windows-vps/setup-github-runner.ps1`
- Workflow trigger: `ops/windows-vps/trigger-deploy-workflow.ps1`

---

## 4) One-Time Server Prerequisites
Install/verify:
- IIS + URL Rewrite
- ASP.NET Core Hosting Bundle / .NET 8 runtime
- .NET 8 SDK (for publish)
- Node.js + npm (for frontend builds)
- SQL Server
- SSL certs bound for all domains (SNI)
- Firewall inbound rules for `80` and `443`

---

## 5) One-Time Repo Setup on VPS
```powershell
cd C:\
git clone https://github.com/noshahi-devs/elicom-backend.git Elicom
cd C:\Elicom\aspnet-core
dotnet restore Elicom.sln
```

---

## 6) API Runtime Environment Variables (IIS App Pool)
Set in app pool `elicom-api-pool` (not in repo secrets):
- `ASPNETCORE_ENVIRONMENT=Production`
- `ConnectionStrings__DefaultConnection=...`
- `App__ServerRootAddress=https://api.worldcartus.com/`
- `App__ClientRootAddress=https://worldcartus.com/`
- `App__CorsOrigins=...`
- SMTP vars (per your current provider)
- File storage vars:
  - `FileStorage__LocalRootPath=C:\data\uploads`
  - `FileStorage__RequestPath=/uploads`
  - `FileStorage__PublicBaseUrl=https://api.worldcartus.com`

Create storage folder and permissions:
```powershell
New-Item -ItemType Directory -Path "C:\data\uploads\primeship-products" -Force | Out-Null
icacls "C:\data\uploads" /grant "IIS AppPool\elicom-api-pool:(OI)(CI)M" /T
```

---

## 7) Standard Deployment (Manual)
Run in **elevated PowerShell** on VPS:

All (API + frontends):
```powershell
cd C:\Elicom
.\ops\windows-vps\deploy-all.ps1
```

API only:
```powershell
.\ops\windows-vps\deploy-all.ps1 -SkipFrontends
```

Frontends only:
```powershell
.\ops\windows-vps\deploy-all.ps1 -SkipApi
```

PrimeShip frontend only with rebuild:
```powershell
.\ops\windows-vps\deploy-all.ps1 -SkipApi -BuildFrontends -Frontends "primeship"
```

Use current checked-out code only (skip git pull):
```powershell
.\ops\windows-vps\deploy-all.ps1 -SkipGitPull
```

---

## 8) CI/CD via GitHub Actions (Optional)
Workflow:
- `.github/workflows/deploy-vps.yml`

Requirements:
- Self-hosted runner installed on VPS
- Runner service should run with admin-capable account (LocalSystem recommended for this setup)

Install/replace runner:
```powershell
cd C:\Elicom
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\setup-github-runner.ps1 `
  -RepoOwner "noshahi-devs" `
  -RepoName "elicom-backend" `
  -GithubPat "PUT_PAT" `
  -RunnerName "vps-elicom-01" `
  -RunnerLabels "self-hosted,windows,vps,elicom" `
  -ReplaceExisting
```

Trigger from GitHub UI:
- Actions -> `Deploy To Windows VPS` -> Run workflow

---

## 9) Database Migration
If EF migrations changed:
```powershell
cd C:\deploy\elicom-migrator
.\Elicom.Migrator.exe
```

---

## 10) Switching API Database (Production <-> Testing)
Change only app pool env var `ConnectionStrings__DefaultConnection`.

Example (switch to `Elicom_Testing`):
```powershell
$appcmd = "$env:windir\System32\inetsrv\appcmd.exe"
$pool = "elicom-api-pool"
$conn = "Server=localhost;Database=Elicom_Testing;User Id=elicom_app;Password=PUT_PASSWORD;TrustServerCertificate=True;MultipleActiveResultSets=True;"

& $appcmd set config -section:system.applicationHost/applicationPools "/-[name='$pool'].environmentVariables.[name='ConnectionStrings__DefaultConnection']" /commit:apphost 2>$null
& $appcmd set config -section:system.applicationHost/applicationPools "/+[name='$pool'].environmentVariables.[name='ConnectionStrings__DefaultConnection',value='$conn']" /commit:apphost
Import-Module WebAdministration
Restart-WebAppPool -Name $pool
```

---

## 11) Post-Deploy Verification
```powershell
Invoke-WebRequest "https://api.worldcartus.com/swagger/index.html" -UseBasicParsing | Select StatusCode
Invoke-WebRequest "https://worldcartus.com" -UseBasicParsing | Select StatusCode
Invoke-WebRequest "https://easyfinora.com" -UseBasicParsing | Select StatusCode
Invoke-WebRequest "https://primeshipuk.com" -UseBasicParsing | Select StatusCode
```

Also test in browser:
- Registration + verification email
- Login
- Category/product CRUD
- Image upload and image URL open under `/uploads/...`

---

## 12) Common Issues + Fixes

### A) SPA refresh gives IIS 404
Cause: missing/incorrect frontend `web.config`.
Fix: redeploy frontend with current `deploy-all.ps1` (it now writes SPA rewrite config automatically).

### B) CORS errors to old Azure API URL
Cause: stale frontend bundle or old prod environment URL.
Fix:
1. Ensure source points to `https://api.worldcartus.com/api`.
2. Rebuild/redeploy frontend.
3. Clear browser cache/service worker.

### C) API publish fails because DLL locked by IIS worker process
Use deploy script (it uses `app_offline.htm` safe swap). Avoid direct publish into live folder manually.

### D) SMTP authentication fails
Check:
- provider host/port
- username/password
- sender mailbox exists and auth is enabled
- app pool env vars actually updated

### E) 403 on admin APIs (e.g., category create)
Cause: missing role permissions for tenant role.
Fix: grant required ABP permissions in DB and/or deploy latest permission seed updates.

---

## 13) Security Rules
- Never commit real passwords/tokens/connection strings in repo.
- Keep secrets in IIS app pool env vars.
- Rotate any credential exposed in chat/history/logs.
- Back up:
  - DB
  - `C:\data\uploads`
  - IIS config exports

---

## 14) Current Domain Mapping
- API: `api.worldcartus.com` -> `C:\sites\elicom-api`
- WorldCart frontend: `worldcartus.com` (+`www`) -> `C:\sites\elicom-main`
- EasyFinora frontend: `easyfinora.com` (+`www`) -> `C:\sites\easy-finora`
- PrimeShip frontend: `primeshipuk.com` (+`www`) -> `C:\sites\primeship`

---

## 15) Handoff Quick Start (for new dev)
1. Pull latest code on VPS.
2. Run deploy script in admin PowerShell.
3. Verify API + all domains.
4. Run smoke tests (auth, email, uploads, admin CRUD).
5. If any issue, check:
   - `C:\sites\elicom-api\App_Data\Logs\Logs.txt`
   - IIS site bindings/app pool
   - app pool environment variables
   - browser cache/service worker for frontend issues
