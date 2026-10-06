@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   PDF Studio Web v1.2.0 - Atualizacao
echo ==========================================
echo.
echo [1/3] Instalando/atualizando dependencias...
call npm install
if errorlevel 1 goto :erro

echo.
echo [2/3] Limpando build anterior...
if exist dist rmdir /s /q dist

echo.
echo [3/3] Gerando build de producao...
call npm run build
if errorlevel 1 goto :erro

echo.
echo [OK] Build concluido.
echo Teste localmente com: npm run dev
echo Depois publique com: npx wrangler deploy
pause
exit /b 0

:erro
echo.
echo [ERRO] A atualizacao/build falhou. Copie a tela e envie.
pause
exit /b 1
