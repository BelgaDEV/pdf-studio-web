@echo off
setlocal
cd /d "%~dp0"
echo.
echo PDF Studio Web v1.7.2 - Bookmarks Pro hierarquicos
echo ====================================================
echo.
echo [1/3] Instalando/atualizando dependencias...
call npm install
if errorlevel 1 goto :erro

echo.
echo [2/3] Validando TypeScript e build...
call npm run build
if errorlevel 1 goto :erro

echo.
echo [3/3] Pronto. Para testar localmente execute:
echo npm run dev
echo.
pause
exit /b 0

:erro
echo.
echo [ERRO] A instalacao/build falhou. Copie a tela e envie para analise.
pause
exit /b 1
