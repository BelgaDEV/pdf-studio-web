@echo off
setlocal
cd /d "%~dp0"
echo PDF Studio Web v1.8.2
echo.
echo [1/3] Instalando dependencias...
call npm install || goto :erro
echo.
echo [2/3] Validando build...
call npm run build || goto :erro
echo.
echo [3/3] Concluido.
echo Rode: npm run dev
pause
exit /b 0
:erro
echo.
echo [ERRO] A instalacao/build falhou. Copie a tela e envie para analise.
pause
exit /b 1
