@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo   PDF Studio v2.1.2 - Quality Gate completo
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
echo [1/10] Instalando dependencias e atualizando package-lock...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/10] Validando TypeScript...
call npm run check
if errorlevel 1 goto fail

echo.
echo [3/10] Executando testes unitarios e de seguranca...
call npm run test
if errorlevel 1 goto fail

echo.
echo [4/10] Executando regressao PDF...
call npm run test:pdf
if errorlevel 1 goto fail

echo.
echo [5/10] Auditando dependencias high/critical...
call npm run security
if errorlevel 1 goto fail

echo.
echo [6/10] Gerando build de producao...
call npm run build
if errorlevel 1 goto fail

echo.
echo [7/10] Validando lazy loading e bundle inicial...
call npm run performance:bundle
if errorlevel 1 goto fail

echo.
echo [8/10] Garantindo Chromium do Playwright...
call npm run quality:install
if errorlevel 1 goto fail

echo.
echo [9/10] Quality Gate - 9 fluxos criticos deterministas...
call npm run test:quality
if errorlevel 1 goto fail

echo.
echo [10/10] Quality Gate - OCR real e camada pesquisavel...
echo Esta etapa pode baixar o modelo ENG do Tesseract na primeira execucao.
call npm run test:quality:ocr
if errorlevel 1 goto fail

echo.
echo [OK] v2.1.2 Quality Gate completo: 10 fluxos criticos aprovados.
echo Relatorios: quality-results\
echo.
echo Abrindo servidor local em http://localhost:5173
start "" http://localhost:5173
call npm run dev -- --host 127.0.0.1
exit /b 0

:fail
echo.
echo [ERRO] O Quality Gate falhou. NAO publique esta versao antes de corrigir.
echo Consulte quality-results\ e copie a saida do PowerShell para analise.
pause
exit /b 1
