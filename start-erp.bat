@echo off
title Happy Bonding ERP Auto-Start
echo Starting Happy Bonding ERP Server...
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 pause
