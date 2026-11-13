import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAudit } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  const [types, balances, requests] = await Promise.all([
    prisma.leaveType.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.leaveBalance.findMany({
      where: { year, employee: { companyId: session.companyId } },
      include: {
        leaveType: true,
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
      },
      orderBy: { employee: { employeeNumber: "asc" } },
    }),
    prisma.leaveRequest.findMany({
      where: { employee: { companyId: session.companyId } },
      include: {
        leaveType: true,
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return NextResponse.json({ types, balances, requests, year });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json();
    const { employeeId, leaveTypeId, startDate, endDate, days, reason } = body;

    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      return NextResponse.json({ error: "بيانات الإجازة غير مكتملة" }, { status: 400 });
    }

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: session.companyId },
    });
    if (!emp) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: leaveTypeId, companyId: session.companyId },
    });
    if (!leaveType) return NextResponse.json({ error: "نوع الإجازة غير موجود" }, { status: 404 });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const computedDays =
      days != null
        ? Number(days)
        : Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const request = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        days: computedDays,
        reason: reason || null,
        status: "PENDING",
      },
      include: {
        leaveType: true,
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "LeaveRequest",
      entityId: request.id,
      action: "CREATE",
      newValue: { employeeId, leaveTypeId, days: computedDays },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: "المعرّف والحالة مطلوبان" }, { status: 400 });
    }
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    const existing = await prisma.leaveRequest.findFirst({
      where: { id, employee: { companyId: session.companyId } },
      include: { leaveType: true },
    });
    if (!existing) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "الطلب تمت معالجته مسبقاً" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reqUpdated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status,
          approvedById: session.userId,
          approvedAt: new Date(),
        },
        include: {
          leaveType: true,
          employee: { select: { id: true, employeeNumber: true, fullName: true } },
        },
      });

      if (status === "APPROVED") {
        const year = existing.startDate.getFullYear();
        const bal = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: existing.employeeId,
              leaveTypeId: existing.leaveTypeId,
              year,
            },
          },
        });
        if (bal) {
          await tx.leaveBalance.update({
            where: { id: bal.id },
            data: {
              used: bal.used + existing.days,
              remaining: Math.max(0, bal.remaining - existing.days),
            },
          });
        }
      }

      return reqUpdated;
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "LeaveRequest",
      entityId: id,
      action: status === "APPROVED" ? "APPROVE" : "REJECT",
      oldValue: { status: existing.status },
      newValue: { status },
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
