@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo      PDF Studio Web - Instalar e testar
echo =============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  echo Instale Node.js 22 LTS e tente novamente.
  echo https://nodejs.org/
  pause
  exit /b 1
)

echo [OK] Node encontrado:
node --version

echo.
echo [1/3] Instalando dependencias...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/3] Validando TypeScript e build...
call npm run build
if errorlevel 1 goto fail

echo.
echo [3/3] Abrindo servidor local...
echo O navegador deve abrir em http://localhost:5173
start "" http://localhost:5173
call npm run dev -- --host 127.0.0.1
exit /b 0

:fail
echo.
echo [ERRO] A instalacao/build falhou. Copie a tela e me envie.
pause
exit /b 1
