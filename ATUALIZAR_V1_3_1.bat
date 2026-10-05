@echo off
setlocal
cd /d "%~dp0"
echo =========================================
echo   PDF Studio Web - Atualizar v1.3.1
ECHO =========================================
echo.
echo [1/3] Instalando/atualizando dependencias...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/3] Validando build de producao...
call npm run build
if errorlevel 1 goto fail

echo.
echo [3/3] Build concluido.
echo Para testar localmente: npm run dev
echo Para publicar depois: npx wrangler deploy
echo.
pause
exit /b 0

:fail
echo.
echo [ERRO] A atualizacao/build falhou.
pause
exit /b 1
