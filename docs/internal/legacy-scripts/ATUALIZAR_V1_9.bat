@echo off
cd /d "%~dp0"
echo [1/3] Instalando dependencias...
call npm install || goto :erro
echo [2/3] Validando TypeScript e build...
call npm run build || goto :erro
echo [3/3] Build concluido. Teste com: npm run dev
pause
exit /b 0
:erro
echo.
echo [ERRO] A instalacao/build falhou. Copie a tela e envie para analise.
pause
exit /b 1
