# Push Kumar Oil Mill to GitHub (repo: kumars_oil_mill)
# Run from PowerShell:  & "e:\project\kumar's shop\scripts\push-to-github.ps1"

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath "e:\project\kumar's shop"

$repoName = "kumars_oil_mill"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Install Git: https://git-scm.com"
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "Install GitHub CLI: https://cli.github.com then run: gh auth login"
}

gh auth status | Out-Null

if (-not (Test-Path .git)) {
  git init -b main
}

if (Test-Path .env) {
  git check-ignore -q .env
  if ($LASTEXITCODE -ne 0) {
    throw ".env is not ignored — add .env to .gitignore before pushing"
  }
}

git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "Initial commit: Kumar Oil Mill management app"
} else {
  Write-Host "No changes to commit."
}

$view = gh repo view $repoName 2>$null
if ($LASTEXITCODE -ne 0) {
  gh repo create $repoName --public --description "Oil Mill Management - React, Supabase, Netlify" --source=. --remote=origin --push
} else {
  if (-not (git remote get-url origin 2>$null)) {
    $user = (gh api user -q .login)
    git remote add origin "https://github.com/$user/$repoName.git"
  }
  git push -u origin main
}

$user = (gh api user -q .login)
Write-Host ""
Write-Host "Repository: https://github.com/$user/$repoName"
