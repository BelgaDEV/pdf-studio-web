@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo PDF Studio Web v1.4.1 - Validacao local
echo ==========================================
echo.
call npm install
if errorlevel 1 goto :erro
call npm run build
if errorlevel 1 goto :erro
echo.
echo Build concluido. Rode npm run dev para testar 1440 PDFs.
pause
exit /b 0
:erro
echo.
echo Ocorreu um erro. Copie a mensagem acima e envie para analise.
pause
exit /b 1
