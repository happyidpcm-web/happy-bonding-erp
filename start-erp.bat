@echo off
title Happy Bonding ERP Auto-Start
echo Starting Happy Bonding ERP Server...
cd /d "d:\Project\Happy Bonding BillBook\happy-bonding-erp"

rem Ensure Prisma client is generated
call npx prisma generate

rem Start dev server and backend API
start "Happy Bonding API" cmd /k "npm run dev:api"
start "Happy Bonding Frontend" cmd /k "npm run dev"

echo Happy Bonding ERP launched successfully!
