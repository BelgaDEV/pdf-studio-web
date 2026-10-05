@echo off
setlocal
cd /d "%~dp0"
echo ===============================================
echo PDF Studio Web v1.7.0 - Legal / Business
echo ===============================================
echo.
echo [1/3] Instalando/atualizando dependencias...
call npm install
if errorlevel 1 goto erro

echo.
echo [2/3] Validando build de producao...
call npm run build
if errorlevel 1 goto erro

echo.
echo [3/3] Build concluido.
echo Teste com: npm run dev
echo Depois publique com: npx wrangler deploy
echo.
pause
exit /b 0

:erro
echo.
echo [ERRO] A atualizacao/build falhou. Copie a tela e envie para revisao.
pause
exit /b 1
