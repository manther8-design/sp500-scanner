import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const year = Number(new URL(req.url).searchParams.get("year") || 2026);
  const month = Number(new URL(req.url).searchParams.get("month") || 11);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  const records = await prisma.attendanceRecord.findMany({
    where: { workDate: { gte: from, lte: to }, employee: { companyId: session.companyId } },
    include: { employee: true },
    orderBy: [{ workDate: "asc" }, { employee: { employeeNumber: "asc" } }],
  });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const workDate = new Date(body.workDate);
  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_workDate: { employeeId: body.employeeId, workDate } },
  });

  if (existing && body.amend) {
    await prisma.attendanceAmendment.create({
      data: {
        recordId: existing.id,
        fieldName: body.fieldName || "status",
        oldValue: String(existing.status),
        newValue: String(body.status),
        reason: body.reason || "تعديل إداري",
        changedById: session.userId,
        approvedById: session.userId,
        approvedAt: new Date(),
      },
    });
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_workDate: { employeeId: body.employeeId, workDate } },
    create: {
      employeeId: body.employeeId,
      workDate,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      lateMinutes: Number(body.lateMinutes || 0),
      earlyLeaveMinutes: Number(body.earlyLeaveMinutes || 0),
      workedHours: Number(body.workedHours || 0),
      overtimeHours: Number(body.overtimeHours || 0),
      status: body.status || "PRESENT",
      source: body.source || "MANUAL",
      notes: body.notes,
    },
    update: {
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      lateMinutes: Number(body.lateMinutes || 0),
      earlyLeaveMinutes: Number(body.earlyLeaveMinutes || 0),
      workedHours: Number(body.workedHours || 0),
      overtimeHours: Number(body.overtimeHours || 0),
      status: body.status || "PRESENT",
      notes: body.notes,
    },
  });

  await writeAudit({
    companyId: session.companyId,
    userId: session.userId,
    entityType: "AttendanceRecord",
    entityId: record.id,
    action: existing ? "UPDATE" : "CREATE",
    oldValue: existing,
    newValue: record,
  });

  return NextResponse.json(record);
}
