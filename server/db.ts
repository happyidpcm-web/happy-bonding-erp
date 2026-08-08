import { PrismaClient } from "@prisma/client";

declare global { var __happyBondingPrisma: PrismaClient | undefined; }
export const db = globalThis.__happyBondingPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__happyBondingPrisma = db;
