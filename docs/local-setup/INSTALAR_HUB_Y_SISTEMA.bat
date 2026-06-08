@echo off
title INSTALADOR HUB LOCAL MMM v3.0
setlocal enabledelayedexpansion

:: --- CONFIGURACION POR DEFECTO ---
if not defined SYSTEM_URL (
    set "TENANT_SLUG=mmm"
    set "SYSTEM_URL=https://mmmsystem.vercel.app"
)
:: ---------------------------------

:: Directorio actual (raíz del proyecto, subiendo un nivel desde docs/local-setup)
set "ROOT=%~dp0..\"
cd /d "%ROOT%"

echo ======================================================
echo    CONFIGURACION DE HUB LOCAL - MMM SYSTEM
echo ======================================================
echo.

:: 1. Verificar Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Por favor instala Node.js desde https://nodejs.org/
    pause
    exit /b
)

:: 2. Configurar Acceso Directo al Inicio de Windows
echo Configurando inicio automatico con Windows...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SCRIPT_PATH=%ROOT%scripts\printer-bridge.js"
set "BAT_PATH=%ROOT%run_bridge_silently.bat"

:: Crear un bat para ejecutar el bridge sin ventana persistente (opcional) o con titulo
(
echo @echo off
echo cd /d "%ROOT%"
echo title MMM LOCAL HUB - NO CERRAR
echo :loop
echo node scripts\printer-bridge.js
echo echo El servidor se cerro inesperadamente. Reiniciando en 5 segundos...
echo timeout /t 5
echo goto loop
) > "%BAT_PATH%"

:: Crear el acceso directo usando PowerShell
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%STARTUP_FOLDER%\MMM_Local_Hub.lnk');$s.TargetPath='%BAT_PATH%';$s.WorkingDirectory='%ROOT%';$s.WindowStyle=7; $s.Save()"

echo.
echo [OK] El Hub se iniciara automaticamente cada vez que enciendas la PC.
echo.

:: 3. Mostrar IP Local para las tablets
echo ======================================================
echo    INFORMACION PARA LAS TABLETS / TERMINALES
echo ======================================================
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" /c:"Dirección IPv4"') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    echo TU DIRECCION IP LOCAL ES: !IP!
)
echo.
echo PASOS PARA LAS TERMINALES:
echo 1. Abre el sistema en la tablet.
echo 2. Ve a Configuración de Panel de Pedidos.
echo 3. En 'IP del Bridge Local', escribe la IP mostrada arriba.
echo 4. ¡Listo! La terminal ya puede funcionar sin internet.
echo ======================================================
echo.

:: 4. Iniciar ahora mismo
echo Iniciando Hub Local ahora...
start "" "%BAT_PATH%"

if defined SYSTEM_URL (
    echo Creando acceso directo al Panel de Pedidos en el Escritorio...
    set "SHORTCUT_PATH=%USERPROFILE%\Desktop\MMM System - Admin.url"
    (
        echo [InternetShortcut]
        echo URL=!SYSTEM_URL!
        echo IconIndex=0
    ) > "!SHORTCUT_PATH!"
    
    echo Abriendo Panel de Pedidos en el navegador...
    start "" "!SYSTEM_URL!"
)

echo.
echo Proceso completado. Ya puedes cerrar esta ventana.
pause
