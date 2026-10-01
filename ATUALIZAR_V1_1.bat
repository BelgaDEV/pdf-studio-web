@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   PDF Studio Web v1.1 - Atualizacao WASM
echo ============================================
echo.
echo [1/3] Instalando/atualizando dependencias...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/3] Validando TypeScript e build de producao...
call npm run build
if errorlevel 1 goto fail

echo.
echo [3/3] Concluido.
echo.
echo [OK] A pasta dist foi gerada com o novo motor de compressao.
echo Teste localmente com: npm run dev
echo Publique com: npx wrangler deploy
pause
exit /b 0

:fail
echo.
echo [ERRO] A atualizacao/build falhou. Copie a tela completa e envie.
pause
exit /b 1
