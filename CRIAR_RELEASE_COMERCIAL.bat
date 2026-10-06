@echo off
setlocal
cd /d "%~dp0"

echo [1/5] Instalando dependencias...
if exist package-lock.json (
  call npm ci
) else (
  echo AVISO: package-lock.json ainda nao existe. Gerando com npm install.
  call npm install
)
if errorlevel 1 goto :erro

echo [2/5] TypeScript + testes + regressao PDF...
call npm run ci
if errorlevel 1 goto :erro

echo [3/5] Security check...
call npm run security
if errorlevel 1 goto :erro

echo [4/5] Montando pacote comercial...
call npm run release:commercial
if errorlevel 1 goto :erro

echo [5/5] Compactando ZIP...
if exist "release\PDFStudio_Commercial.zip" del /q "release\PDFStudio_Commercial.zip"
powershell -NoProfile -Command "Compress-Archive -Path 'release\commercial\*' -DestinationPath 'release\PDFStudio_Commercial.zip' -Force"
if errorlevel 1 goto :erro

echo.
echo Release pronta: release\PDFStudio_Commercial.zip
exit /b 0

:erro
echo.
echo [ERRO] A release nao foi gerada. Revise a mensagem acima.
exit /b 1
