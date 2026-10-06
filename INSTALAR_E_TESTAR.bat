@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo   PDF Studio v2.0.8 - Instalar e validar
echo =============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  echo Instale Node.js 22 LTS ou Node.js 24 e tente novamente.
  pause
  exit /b 1
)

echo [OK] Node encontrado:
node --version

echo.
echo [1/7] Instalando dependencias e atualizando package-lock...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/7] Validando TypeScript...
call npm run check
if errorlevel 1 goto fail

echo.
echo [3/7] Executando testes unitarios e de seguranca...
call npm run test
if errorlevel 1 goto fail

echo.
echo [4/7] Executando regressao PDF...
call npm run test:pdf
if errorlevel 1 goto fail

echo.
echo [5/7] Auditando dependencias high/critical...
call npm run security
if errorlevel 1 goto fail

echo.
echo [6/7] Gerando build de producao...
call npm run build
if errorlevel 1 goto fail

echo.
echo [7/7] Validando lazy loading e bundle inicial...
call npm run performance:bundle
if errorlevel 1 goto fail

echo.
echo [OK] v2.0.8 validada. Abrindo servidor local...
echo http://localhost:5173
start "" http://localhost:5173
call npm run dev -- --host 127.0.0.1
exit /b 0

:fail
echo.
echo [ERRO] A validacao falhou. Copie a saida do PowerShell e envie para analise.
pause
exit /b 1
