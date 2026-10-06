@echo off
setlocal
cd /d "%~dp0"
echo =============================================
echo   PDF Studio v2.0.8 - Security Gate
echo =============================================
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 exit /b 1
)
call npm run security:prod
if errorlevel 1 goto fail
call npm run security:all
if errorlevel 1 goto fail
echo.
echo [OK] Nenhuma vulnerabilidade HIGH/CRITICAL bloqueante encontrada pelo npm audit.
exit /b 0
:fail
echo.
echo [ERRO] O security gate encontrou vulnerabilidade HIGH/CRITICAL.
exit /b 1
