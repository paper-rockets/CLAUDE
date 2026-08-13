@echo off
title Wanderlust Server
cd /d "%~dp0"
echo ==========================================
echo Starting Wanderlust WebGPU Dev Server...
echo ==========================================
echo.
npm run dev
pause
