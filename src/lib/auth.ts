import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "erp_session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export type SessionPayload = {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  companyId: string;
  roleCodes: string[];
  permissions: string[];
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload, expiresIn = "7d") {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function hasPermission(session: SessionPayload, code: string) {
  if (session.roleCodes.includes("SUPER_ADMIN") || session.roleCodes.includes("COMPANY_OWNER")) {
    return true;
  }
  return session.permissions.includes(code) || session.permissions.includes("*");
}

export async function loadUserAuthContext(userId: string, companyId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      companies: { include: { company: true } },
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  if (!user || !user.isActive) return null;

  const selected =
    user.companies.find((c) => c.companyId === companyId) ||
    user.companies.find((c) => c.isDefault) ||
    user.companies[0];
  if (!selected) return null;

  const roleCodes = user.roles.map((r) => r.role.code);
  const permissions = [
    ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))),
  ];

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    organizationId: user.organizationId,
    companyId: selected.companyId,
    roleCodes,
    permissions,
  } satisfies SessionPayload;
}

export async function writeAudit(params: {
  companyId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId || null,
      userId: params.userId || null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      ip: params.ip || null,
    },
  });
}
