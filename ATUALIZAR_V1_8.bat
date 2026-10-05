@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo PDF Studio Web v1.8.1 - Document Trust Report
echo ================================================
echo.
call npm install
if errorlevel 1 goto :erro
call npm run build
if errorlevel 1 goto :erro
echo.
echo Build concluido. Teste com: npm run dev
echo Depois de homologar: git add . ^&^& git commit -m "Adiciona Document Trust Report v1.8" ^&^& git push
echo Publicacao: npx wrangler deploy
goto :fim
:erro
echo.
echo Ocorreu um erro. Revise a mensagem acima antes de publicar.
:fim
pause
