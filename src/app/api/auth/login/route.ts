import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  loadUserAuthContext,
  setSessionCookie,
  verifyPassword,
  writeAudit,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || "").toLowerCase().trim();
  const password = String(body.password || "");
  const ip = req.headers.get("x-forwarded-for") || null;

  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.loginAttempt.create({
    data: {
      userId: user?.id,
      email,
      success: false,
      ip,
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  const ctx = await loadUserAuthContext(user.id);
  if (!ctx) {
    return NextResponse.json({ error: "لا توجد شركة مرتبطة بالمستخدم" }, { status: 403 });
  }

  const token = await createSessionToken(ctx);
  await setSessionCookie(token);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.loginAttempt.create({
    data: { userId: user.id, email, success: true, ip },
  });
  await writeAudit({
    companyId: ctx.companyId,
    userId: user.id,
    entityType: "User",
    entityId: user.id,
    action: "LOGIN",
    ip,
  });

  return NextResponse.json({
    user: {
      id: ctx.userId,
      fullName: ctx.fullName,
      email: ctx.email,
      companyId: ctx.companyId,
      roles: ctx.roleCodes,
    },
  });
}
