@echo off
title Happy Bonding ERP Launcher
echo Starting Happy Bonding Men's Wear ERP Offline Server...
cd /d "%~dp0"
echo [%date% %time%] Starting API server... > api.log
echo. > api-error.log
echo [%date% %time%] Starting web server... > web.log
echo. > web-error.log
start "Happy Bonding API" /min cmd /k "npm.cmd run dev:api >> api.log 2>> api-error.log"
start "Happy Bonding Web" /min cmd /k "npm.cmd run dev >> web.log 2>> web-error.log"
ping 127.0.0.1 -n 9 >nul
start http://localhost:5173/
exit
