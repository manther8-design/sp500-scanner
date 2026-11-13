import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAudit } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const [types, incentives] = await Promise.all([
    prisma.incentiveType.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.employeeIncentive.findMany({
      where: {
        employee: { companyId: session.companyId },
        ...(status ? { status } : {}),
      },
      include: {
        incentiveType: true,
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ types, incentives });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json();
    const { employeeId, incentiveTypeId, amount, period, reason } = body;

    if (!employeeId || !incentiveTypeId || amount == null) {
      return NextResponse.json({ error: "بيانات الحافز غير مكتملة" }, { status: 400 });
    }

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: session.companyId },
    });
    if (!emp) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

    const type = await prisma.incentiveType.findFirst({
      where: { id: incentiveTypeId, companyId: session.companyId },
    });
    if (!type) return NextResponse.json({ error: "نوع الحافز غير موجود" }, { status: 404 });

    const incentive = await prisma.employeeIncentive.create({
      data: {
        employeeId,
        incentiveTypeId,
        amount: Number(amount),
        period: period || null,
        reason: reason || null,
        status: "PENDING",
      },
      include: {
        incentiveType: true,
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "EmployeeIncentive",
      entityId: incentive.id,
      action: "CREATE",
      newValue: { employeeId, amount: incentive.amount },
    });

    return NextResponse.json(incentive, { status: 201 });
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

    const existing = await prisma.employeeIncentive.findFirst({
      where: { id, employee: { companyId: session.companyId } },
    });
    if (!existing) return NextResponse.json({ error: "الحافز غير موجود" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "تمت معالجة الحافز مسبقاً" }, { status: 400 });
    }

    const updated = await prisma.employeeIncentive.update({
      where: { id },
      data: {
        status,
        approvedById: session.userId,
        approvedAt: new Date(),
      },
      include: {
        incentiveType: true,
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "EmployeeIncentive",
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
