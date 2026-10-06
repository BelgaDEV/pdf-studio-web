@echo off
cd /d "%~dp0"
echo ===============================================
echo PDF Studio Web v1.4.2 - Mesclagem 1.440 PDFs
echo ===============================================
call npm install
if errorlevel 1 goto erro
call npm run build
if errorlevel 1 goto erro
echo.
echo Build concluido. Rode: npm run dev
pause
exit /b 0
:erro
echo.
echo ERRO. Copie esta tela e envie para analise.
pause
exit /b 1
