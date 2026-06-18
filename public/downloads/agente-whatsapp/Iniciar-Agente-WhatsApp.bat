@echo off
title MMM System - Agente WhatsApp IA
color 0D
echo.
echo  ========================================
echo    MMM SYSTEM - Agente WhatsApp IA
echo  ========================================
echo.
echo  Iniciando agente...
echo.

cd /d "%~dp0"

npm install && npm run build && node dist/index.js

echo.
echo  ========================================
echo  El agente se detuvo.
echo  Si hubo un error, revisalo arriba.
echo  ========================================
echo.
pause
