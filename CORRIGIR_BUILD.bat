@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo    PDF Studio Web - Correcao de Build
 echo =============================================

echo Corrigindo tsconfig.node.json...
> tsconfig.node.json echo {"compilerOptions":{"composite":true,"skipLibCheck":true,"module":"ESNext","moduleResolution":"Bundler","allowImportingTsExtensions":true,"noEmit":true},"include":["vite.config.ts"]}

if not exist node_modules (
  echo.
  echo node_modules nao encontrado. Instalando dependencias...
  call npm install
  if errorlevel 1 goto fail
)

echo.
echo Executando build novamente...
call npm run build
if errorlevel 1 goto fail

echo.
echo [OK] Build concluido com sucesso.
echo A pasta pronta para publicar e: dist
pause
exit /b 0

:fail
echo.
echo [ERRO] O build ainda encontrou outro problema.
echo Copie a tela completa e me envie.
pause
exit /b 1
