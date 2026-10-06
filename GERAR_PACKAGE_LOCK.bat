@echo off
setlocal
cd /d "%~dp0"
echo Gerando package-lock.json reproduzivel com npm...
call npm install --package-lock-only
if errorlevel 1 (
  echo Falha ao acessar o registro npm ou resolver dependencias.
  exit /b 1
)
echo package-lock.json criado. Agora execute npm ci para validar.
