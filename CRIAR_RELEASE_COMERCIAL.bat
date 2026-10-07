@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo   PDF Studio v2.1.2 - Release comercial
echo =============================================

echo [1/7] Instalando dependencias...
if exist package-lock.json (
  call npm ci
) else (
  echo AVISO: package-lock.json ainda nao existe. Gerando com npm install.
  call npm install
)
if errorlevel 1 goto :erro

echo [2/7] Auditando dependencias high/critical...
call npm run security
if errorlevel 1 goto :erro

echo [3/7] Garantindo Chromium do Quality Gate...
call npm run quality:install
if errorlevel 1 goto :erro

echo [4/7] Executando Quality Gate completo - 10 fluxos...
call npm run quality:gate:full
if errorlevel 1 goto :erro

echo [5/7] Executando navegacao/UX Playwright...
call npm run test:e2e
if errorlevel 1 goto :erro

echo [6/7] Montando pacote comercial...
call npm run release:commercial
if errorlevel 1 goto :erro

echo [7/7] Compactando ZIP...
if exist "release\PDFStudio_Commercial.zip" del /q "release\PDFStudio_Commercial.zip"
powershell -NoProfile -Command "Compress-Archive -Path 'release\commercial\*' -DestinationPath 'release\PDFStudio_Commercial.zip' -Force"
if errorlevel 1 goto :erro

echo.
echo [OK] Release v2.1.2 aprovada pelo Quality Gate.
echo Release pronta: release\PDFStudio_Commercial.zip
echo Relatorios: quality-results\
exit /b 0

:erro
echo.
echo [ERRO] A release NAO foi gerada. O gate de qualidade falhou ou uma etapa anterior encontrou problema.
exit /b 1
