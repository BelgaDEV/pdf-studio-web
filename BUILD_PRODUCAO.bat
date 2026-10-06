@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build
if errorlevel 1 (
  echo Build falhou.
  pause
  exit /b 1
)
echo.
echo Analisando carregamento inicial...
call npm run performance:bundle
if errorlevel 1 (
  echo Analise de performance falhou.
  pause
  exit /b 1
)
echo.
echo Build concluido. Pasta pronta para hospedagem: dist
pause
