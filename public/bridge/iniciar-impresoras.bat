@echo off
title Puente de Impresión MMM
setlocal enabledelayedexpansion

echo.
echo ======================================================
echo    INICIANDO PUENTE DE IMPRESIÓN MMM...
echo ======================================================
echo.

:: Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Por favor, instalalo desde https://nodejs.org
    pause
    exit /b 1
)

:: Ruta del script (asumimos que esta en la misma carpeta)
set SCRIPT_DIR=%~dp0
set BRIDGE_SCRIPT=%SCRIPT_DIR%printer-bridge.js

if not exist "%BRIDGE_SCRIPT%" (
    echo [ERROR] No se encontro printer-bridge.js en %SCRIPT_DIR%
    pause
    exit /b 1
)

echo [OK] Node.js detectado.
echo [OK] Script del puente encontrado.
echo.
echo Presiona CTRL+C para detener el puente.
echo NO CIERRES esta ventana mientras uses el sistema.
echo.

:: Iniciar el puente
node "%BRIDGE_SCRIPT%"

echo.
echo [INFO] El puente se ha detenido.
pause
