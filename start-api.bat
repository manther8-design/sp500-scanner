@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Atlas Markets - تشغيل الـ API
echo ========================================

where python >nul 2>&1
if errorlevel 1 (
  echo [خطأ] Python غير مثبت أو غير موجود في PATH.
  echo حمّل Python من https://www.python.org/downloads/
  echo وفعّل خيار Add python.exe to PATH أثناء التثبيت.
  pause
  exit /b 1
)

echo [*] تثبيت اعتماديات Python...
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo [خطأ] فشل تثبيت الاعتماديات.
  pause
  exit /b 1
)

set PYTHONPATH=%CD%
set DATABASE_URL=sqlite:///./scanner.db
set TELEGRAM_BOT_TOKEN=
set TELEGRAM_CHAT_ID=
set CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001

echo [*] تشغيل الخادم على http://127.0.0.1:8000
echo [*] Docs: http://127.0.0.1:8000/docs
echo [*] لا تغلق هذه النافذة.
echo.
python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
