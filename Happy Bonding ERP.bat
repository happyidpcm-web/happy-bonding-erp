@echo off
title Happy Bonding ERP Launcher
echo Starting Happy Bonding Men's Wear ERP Offline Server...
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 (
  pause
  exit /b 1
)
start http://localhost:5173/
exit
