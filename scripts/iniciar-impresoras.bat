@echo off
chcp 65001 >nul
title Puente de Impresión MMM

echo.
echo ╔══════════════════════════════════════════════╗
echo ║   INSTALADOR - Puente de Impresión MMM      ║
echo ╚══════════════════════════════════════════════╝
echo.

:: Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js no está instalado.
    echo.
    echo Descargalo de: https://nodejs.org
    echo Después de instalar Node.js, volvé a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js detectado.

:: Obtener ruta del script
set SCRIPT_DIR=%~dp0
set BRIDGE_SCRIPT=%SCRIPT_DIR%printer-bridge.js

if not exist "%BRIDGE_SCRIPT%" (
    echo ❌ No se encontró printer-bridge.js en %SCRIPT_DIR%
    pause
    exit /b 1
)

echo ✅ Script del puente encontrado.
echo.

:: Preguntar si agregar al inicio de Windows
set /p AUTOSTART="¿Querés que el puente se inicie automáticamente con Windows? (S/N): "
if /i "%AUTOSTART%"=="S" (
    :: Crear acceso directo en la carpeta de inicio
    set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
    
    echo Set oWS = WScript.CreateObject("WScript.Shell") > "%temp%\create_shortcut.vbs"
    echo sLinkFile = "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MMM Print Bridge.lnk" >> "%temp%\create_shortcut.vbs"
    echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%temp%\create_shortcut.vbs"
    echo oLink.TargetPath = "node" >> "%temp%\create_shortcut.vbs"
    echo oLink.Arguments = """%BRIDGE_SCRIPT%""" >> "%temp%\create_shortcut.vbs"
    echo oLink.WindowStyle = 7 >> "%temp%\create_shortcut.vbs"
    echo oLink.Description = "Puente de Impresión MMM" >> "%temp%\create_shortcut.vbs"
    echo oLink.Save >> "%temp%\create_shortcut.vbs"
    cscript //nologo "%temp%\create_shortcut.vbs"
    del "%temp%\create_shortcut.vbs"
    
    echo.
    echo ✅ Se agregó al inicio de Windows.
    echo    El puente se ejecutará automáticamente cada vez que enciendas la PC.
)

echo.
echo ══════════════════════════════════════════════
echo  Iniciando Puente de Impresión MMM...
echo  NO CIERRES esta ventana mientras uses el sistema.
echo ══════════════════════════════════════════════
echo.

:: Iniciar el puente
node "%BRIDGE_SCRIPT%"

:: Si llega acá es que se cerró
echo.
echo El puente se ha detenido.
pause
