@echo off
chcp 65001 >nul
echo ================================================
echo PDF Studio Web - Atualizar/testar v1.6.0
echo ================================================
echo.
call npm install
if errorlevel 1 goto erro
call npm run build
if errorlevel 1 goto erro
echo.
echo Build concluido. Para testar localmente execute:
echo npm run dev
echo.
pause
exit /b 0
:erro
echo.
echo ERRO durante instalacao/build.
pause
exit /b 1
