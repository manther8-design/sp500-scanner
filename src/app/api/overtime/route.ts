import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const rows = await prisma.overtimeRequest.findMany({
    where: { employee: { companyId: session.companyId } },
    include: { employee: true },
    orderBy: { workDate: "desc" },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  if (body.action === "approve") {
    const row = await prisma.overtimeRequest.update({
      where: { id: body.id },
      data: { status: "APPROVED", approvedById: session.userId, approvedAt: new Date() },
    });
    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "OvertimeRequest",
      entityId: row.id,
      action: "APPROVE",
    });
    return NextResponse.json(row);
  }
  const row = await prisma.overtimeRequest.create({
    data: {
      employeeId: body.employeeId,
      workDate: new Date(body.workDate),
      startTime: body.startTime,
      endTime: body.endTime,
      hours: Number(body.hours),
      otType: body.otType || "WEEKDAY",
      reason: body.reason,
      status: "PENDING",
    },
  });
  return NextResponse.json(row, { status: 201 });
}
