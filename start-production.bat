@echo off
title Happy Bonding ERP Production
echo Building and Starting Happy Bonding ERP...
cd /d "d:\Project\Happy Bonding BillBook\happy-bonding-erp"

rem Build frontend and generate DB client
call npm run build

rem Run backend API which also serves frontend static files from dist/
call npm start
