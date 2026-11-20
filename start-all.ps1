# Atlas Markets — تشغيل API + الواجهة معاً (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Atlas Markets - تشغيل كامل" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host "[خطأ] Python غير موجود في PATH" -ForegroundColor Red
  exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[خطأ] Node.js غير موجود في PATH" -ForegroundColor Red
  exit 1
}

Write-Host "[*] تثبيت اعتماديات Python..." -ForegroundColor Yellow
python -m pip install -r requirements.txt

if (-not (Test-Path "apps\web\node_modules")) {
  Write-Host "[*] تثبيت اعتماديات الواجهة..." -ForegroundColor Yellow
  Push-Location apps\web
  npm install
  Pop-Location
}

$env:PYTHONPATH = (Get-Location).Path
$env:DATABASE_URL = "sqlite:///./scanner.db"
$env:TELEGRAM_BOT_TOKEN = ""
$env:TELEGRAM_CHAT_ID = ""
$env:CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"

Write-Host "[*] تشغيل API على المنفذ 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$PWD'; `$env:PYTHONPATH='$PWD'; `$env:DATABASE_URL='sqlite:///./scanner.db'; `$env:CORS_ORIGINS='$env:CORS_ORIGINS'; python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8000 --reload"
)

Start-Sleep -Seconds 3

Write-Host "[*] تشغيل الواجهة..." -ForegroundColor Green
Set-Location apps\web
npm run dev
