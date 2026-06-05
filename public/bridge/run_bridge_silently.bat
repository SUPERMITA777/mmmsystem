@echo off
title MMM LOCAL HUB - NO CERRAR
cd /d "%~dp0"

:: Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Por favor, instalalo desde https://nodejs.org
    pause
    exit /b 1
)

if not exist "printer-bridge.js" (
    echo [ERROR] No se encontro printer-bridge.js en esta carpeta.
    echo Por favor, descarga printer-bridge.js y colocalo en la misma carpeta que este archivo.
    pause
    exit /b 1
)

echo Iniciando Puente de Impresion en bucle (auto-reiniciable)...
:loop
node printer-bridge.js
echo.
echo [ALERTA] El puente de impresion se detuvo o se cerro inesperadamente.
echo Reiniciando de forma automatica en 5 segundos...
echo.
timeout /t 5
goto loop
