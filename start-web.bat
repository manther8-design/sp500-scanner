@echo off
chcp 65001 >nul
cd /d "%~dp0apps\web"

echo ========================================
echo   Atlas Markets - تشغيل الواجهة
echo ========================================

where node >nul 2>&1
if errorlevel 1 (
  echo [خطأ] Node.js غير مثبت أو غير موجود في PATH.
  echo حمّل Node من https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo [*] تثبيت اعتماديات الواجهة (مرة واحدة)...
  call npm install
  if errorlevel 1 (
    echo [خطأ] فشل npm install
    pause
    exit /b 1
  )
)

echo [*] تشغيل الواجهة...
echo [*] افتح المتصفح على الرابط الذي يظهر (عادة http://localhost:3000)
echo [*] تأكد أن start-api.bat يعمل في نافذة أخرى.
echo.
call npm run dev
pause
