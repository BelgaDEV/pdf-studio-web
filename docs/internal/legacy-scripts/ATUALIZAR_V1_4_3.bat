@echo off
cd /d "%~dp0"
echo [1/3] Instalando dependencias...
call npm install
if errorlevel 1 goto erro
echo [2/3] Validando build...
call npm run build
if errorlevel 1 goto erro
echo [3/3] Concluido. Rode npm run dev para testar.
pause
exit /b 0
:erro
echo.
echo [ERRO] Falha na instalacao/build. Copie a tela e envie.
pause
exit /b 1
