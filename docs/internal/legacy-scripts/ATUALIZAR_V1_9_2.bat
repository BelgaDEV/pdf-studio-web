@echo off
cd /d %~dp0
npm install
npm run build
if errorlevel 1 pause & exit /b 1
echo Build v1.9.2 concluido.
pause
