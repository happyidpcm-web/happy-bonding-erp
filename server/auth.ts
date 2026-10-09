import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";
import { db } from "./db.js";
import { orderBranches } from "./branch-order.js";

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
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const { payload } = await jwtVerify(token, key);
    const session = payload as unknown as Session;
    const user = await db.user.findUnique({ where: { id: session.userId }, include: { role: true, branches: { include: { branch: true } } } });
    if (!user?.active || user.tokenVersion !== session.tokenVersion) return res.status(401).json({ error: "Session expired. Please sign in again." });
    const owner = user.role.permissions.includes("*");
    const branches = owner ? await db.branch.findMany({ where: { organizationId: user.organizationId, active: true } }) : user.branches.map(m => m.branch).filter(b => b.active && b.organizationId === user.organizationId);
    req.session = { userId: user.id, organizationId: user.organizationId, permissions: user.role.permissions, tokenVersion: user.tokenVersion, branchIds: orderBranches(branches).map(b => b.id) };
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
  let branchId = String(req.headers["x-branch-id"] ?? "").trim();
  if (!branchId) {
    branchId = req.session?.branchIds?.[0] || "";
  }
  if (!branchId) {
    res.status(400).json({ error: "Branch ID header (x-branch-id) is required" });
    return null;
  }
  const hasBranchAccess = req.session?.branchIds?.includes(branchId);
  if (!hasBranchAccess) {
    res.status(403).json({ error: "Branch access denied" });
    return null;
  }
  return branchId;
}

