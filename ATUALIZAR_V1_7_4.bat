@echo off
setlocal
cd /d "%~dp0"
echo.
echo PDF Studio Web v1.7.4 - Validacao local
echo ===========================================
call npm install
if errorlevel 1 goto :erro
call npm run build
if errorlevel 1 goto :erro
echo.
echo Build concluido. Iniciando servidor local...
call npm run dev
exit /b 0
:erro
echo.
echo ERRO: instalacao ou build falhou.
pause
exit /b 1
