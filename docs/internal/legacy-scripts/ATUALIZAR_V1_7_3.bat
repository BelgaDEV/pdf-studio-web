@echo off
setlocal
cd /d %~dp0
echo ========================================
echo PDF Studio Web v1.7.3 - Validacao local
echo ========================================
echo.
call npm install
if errorlevel 1 goto erro
call npm run build
if errorlevel 1 goto erro
echo.
echo Build concluido. Rode: npm run dev
echo Teste /tool/redact antes de publicar.
pause
exit /b 0
:erro
echo.
echo ERRO durante instalacao/build. Nao publique esta versao ainda.
pause
exit /b 1
