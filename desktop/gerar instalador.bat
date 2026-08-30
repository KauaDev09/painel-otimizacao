@echo off
echo ================================
echo   ORION OPTIMIZER - Gerar Build
echo ================================
echo.

cd /d "%~dp0"

echo [1/2] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo [2/2] Gerando instalador NSIS...
call npx electron-builder --win nsis
if errorlevel 1 (
    echo ERRO: Falha ao gerar instalador.
    pause
    exit /b 1
)

echo.
echo ================================
echo   Build concluido!
echo   Installer em: release\
echo ================================
pause
