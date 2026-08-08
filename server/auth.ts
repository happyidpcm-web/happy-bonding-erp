import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";

export interface Session {
  userId: string;
  organizationId: string;
  branchIds: string[];
  permissions: string[];
  tokenVersion: number;
}

declare global {
  namespace Express { interface Request { session?: Session; } }
}

const key = new TextEncoder().encode(env.JWT_SECRET);

export async function createToken(session: Session) {
  return new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(key);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const { payload } = await jwtVerify(token, key);
    req.session = payload as unknown as Session;
    next();
  } catch { res.status(401).json({ error: "Invalid or expired session" }); }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.permissions.includes(permission) && !req.session?.permissions.includes("*"))
      return res.status(403).json({ error: "Permission denied" });
    next();
  };
}

export function requireBranch(req: Request, res: Response) {
  const branchId = String(req.headers["x-branch-id"] ?? "");
  if (!branchId || !req.session?.branchIds.includes(branchId)) {
    res.status(403).json({ error: "Branch access denied" });
    return null;
  }
  return branchId;
}
