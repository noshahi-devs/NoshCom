# Windows VPS Deploy Script

## Script
- `ops/windows-vps/deploy-all.ps1`

## What it does
- Pull latest code from GitHub (`git fetch` + `git pull`)
- Publish API with `app_offline.htm` safe swap
- Deploy frontend files to IIS site folders
- Optional frontend rebuild (`npm ci` + production build)
- Restart IIS

## Run (PowerShell as Administrator)
```powershell
cd C:\Elicom
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\deploy-all.ps1
```

## Common modes
API only:
```powershell
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\deploy-all.ps1 -SkipFrontends
```

Frontends only (copy existing dist only):
```powershell
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\deploy-all.ps1 -SkipApi
```

Frontends with rebuild:
```powershell
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\deploy-all.ps1 -SkipApi -BuildFrontends
```

Deploy one frontend only:
```powershell
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\deploy-all.ps1 -SkipApi -Frontends primeship
```

Deploy selected frontends only:
```powershell
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\deploy-all.ps1 -SkipApi -Frontends elicom-main,easy-finora
```

Skip git pull (use current local branch state):
```powershell
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\deploy-all.ps1 -SkipGitPull
```

## Notes
- If `git pull` fails due to local changes, resolve/stash changes and rerun.
- Frontend deploy expects build output under each frontend `dist` folder.
- `robocopy` mirror is used; destination folder is synced to source output.
- Valid `-Frontends` values: `elicom-main`, `easy-finora`, `primeship`.

## Optional CI/CD (GitHub Actions)
- Workflow file: `.github/workflows/deploy-vps.yml`
- Requires a GitHub **self-hosted Windows runner** installed on your VPS repository.
- Trigger from GitHub Actions -> **Deploy To Windows VPS** -> Run workflow.

### 1) Install self-hosted runner on VPS
Run in elevated PowerShell:
```powershell
cd C:\Elicom
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\setup-github-runner.ps1 `
  -RepoOwner "noshahi-devs" `
  -RepoName "elicom-backend" `
  -GithubPat "PUT_GITHUB_PAT" `
  -RunnerName "vps-elicom-01" `
  -RunnerLabels "self-hosted,windows,vps,elicom" `
  -ReplaceExisting
```

PAT scope for private repos: `repo`.

### 2) Trigger deploy workflow from VPS (no UI)
```powershell
cd C:\Elicom
powershell -ExecutionPolicy Bypass -File .\ops\windows-vps\trigger-deploy-workflow.ps1 `
  -RepoOwner "noshahi-devs" `
  -RepoName "elicom-backend" `
  -GithubPat "PUT_GITHUB_PAT" `
  -Ref "main" `
  -DeployApi $true `
  -DeployFrontends $true `
  -Frontends "elicom-main,easy-finora,primeship" `
  -BuildFrontends $false
```
