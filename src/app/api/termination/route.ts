import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateTermination, approveAndPostTermination } from "@/lib/eos";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const rows = await prisma.termination.findMany({
    where: { employee: { companyId: session.companyId } },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
  const employees = await prisma.employee.findMany({
    where: { companyId: session.companyId, employmentStatus: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] } },
    orderBy: { employeeNumber: "asc" },
  });
  return NextResponse.json({ terminations: rows, employees });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  try {
    if (body.action === "approve") {
      const row = await approveAndPostTermination(body.id, session.userId);
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "Termination",
        entityId: row.id,
        action: "POST",
      });
      return NextResponse.json(row);
    }
    const row = await calculateTermination({
      employeeId: body.employeeId,
      lastWorkDate: new Date(body.lastWorkDate || Date.now()),
      reason: body.reason || "CONTRACT_END",
      otherDues: Number(body.otherDues || 0),
      extraDeductions: Number(body.extraDeductions || 0),
    });
    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "Termination",
      entityId: row.id,
      action: "CREATE",
      newValue: { netSettlement: row.netSettlement },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 400 });
  }
}
