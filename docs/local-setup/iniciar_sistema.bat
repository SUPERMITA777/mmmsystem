@echo off
title MMM System - Lanzador Integrado
cd /d "%~dp0.."

echo ======================================================
echo    INICIANDO SISTEMA INTEGRADO MMM...
echo ======================================================
echo.
echo Iniciando servidor web (Next.js)...
start "Servidor Web MMM" cmd /c "title Servidor Web MMM && npm run dev"

echo Iniciando puente de impresion...
start "Puente de Impresion MMM" cmd /c "title Puente de Impresion MMM && node scripts/printer-bridge.js"

echo.
echo ======================================================
echo Ambos sistemas han sido iniciados.
echo Abriendo en el navegador en unos segundos...
echo ======================================================
timeout /t 5 >nul
start http://localhost:3000
