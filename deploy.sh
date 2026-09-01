#!/usr/bin/env bash
set -e

echo "========================================================="
echo "   Happy Bonding ERP - Cloud VPS Automated Deployment   "
echo "========================================================="

# Ensure .env file exists
if [ ! -f ".env" ]; then
    echo "[!] .env file not found. Copying .env.production.example to .env..."
    cp .env.production.example .env
    echo "[!] Please edit .env file and set strong passwords before running again!"
    exit 1
fi

echo "[1/4] Building production Docker images..."
docker compose -f docker-compose.prod.yml build

echo "[2/4] Starting Happy Bonding ERP & PostgreSQL services..."
docker compose -f docker-compose.prod.yml up -d

echo "[3/4] Running Prisma Database sync & initial seeding..."
docker exec happybonding_app npx prisma db push

echo "[4/4] Checking running service status..."
docker compose -f docker-compose.prod.yml ps

echo "========================================================="
echo " SUCCESS: Happy Bonding ERP deployed successfully!"
echo " Local Access: http://127.0.0.1:4000"
echo " Public Access: https://erp.happybonding.in"
echo "========================================================="
