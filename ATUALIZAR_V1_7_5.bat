@echo off
cd /d "%~dp0"
echo [1/3] Instalando dependencias...
call npm install || goto erro
echo [2/3] Validando build...
call npm run build || goto erro
echo [3/3] Build concluido. Rode npm run dev para homologar.
pause
exit /b 0
:erro
echo.
echo [ERRO] A instalacao/build falhou. Copie a tela e envie para analise.
pause
exit /b 1
