@echo off
title MMM System - Configurar Terminal
color 0B

echo ======================================================
echo    CONFIGURACION DE TERMINAL LOCAL - MMM SYSTEM
echo ======================================================
echo.

:: 1. Verificar Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Por favor, descarga e instala Node.js desde https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Node.js detectado correctamente.
echo.

:: 2. Instalar dependencias
echo [2/3] Instalando dependencias (esto puede tardar unos minutos)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Hubo un problema al instalar las dependencias.
    pause
    exit /b
)

echo.
echo [3/3] Dependencias instaladas con exito.
echo.

echo ======================================================
echo    INSTALACION COMPLETADA
echo ======================================================
echo.
echo Para iniciar el sistema, usa el comando: npm run dev
echo.
echo La aplicacion estara disponible en: http://localhost:3000
echo.
pause
