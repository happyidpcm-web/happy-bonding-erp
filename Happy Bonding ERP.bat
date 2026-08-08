@echo off
title Happy Bonding ERP Launcher
echo Starting Happy Bonding Men's Wear ERP Offline Server...
cd /d "%~dp0"
start /min cmd /c "npm run dev:api"
start /min cmd /c "npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173/
exit
