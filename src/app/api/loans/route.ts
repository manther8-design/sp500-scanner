import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAudit } from "@/lib/auth";
import { round2 } from "@/lib/utils";

function buildSchedule(startDeductDate: Date, installments: number, installmentAmount: number, total: number) {
  const schedule = [];
  let remaining = round2(total);
  for (let i = 0; i < installments; i++) {
    const due = new Date(startDeductDate.getFullYear(), startDeductDate.getMonth() + i, startDeductDate.getDate());
    const amount = i === installments - 1 ? remaining : round2(installmentAmount);
    remaining = round2(remaining - amount);
    schedule.push({ dueDate: due, amount, status: "PENDING" as const });
  }
  return schedule;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const loans = await prisma.loan.findMany({
    where: {
      employee: { companyId: session.companyId },
      ...(status ? { status } : {}),
    },
    include: {
      employee: { select: { id: true, employeeNumber: true, fullName: true } },
      schedule: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(loans);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      employeeId,
      loanType,
      amount,
      installments,
      installmentAmount,
      startDeductDate,
      notes,
      approve,
    } = body;

    if (!employeeId || !amount || !installments || !startDeductDate) {
      return NextResponse.json({ error: "بيانات القرض غير مكتملة" }, { status: 400 });
    }

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: session.companyId },
    });
    if (!emp) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

    const total = round2(Number(amount));
    const count = Math.max(1, Number(installments));
    const per =
      installmentAmount != null
        ? round2(Number(installmentAmount))
        : round2(total / count);
    const start = new Date(startDeductDate);
    const schedule = buildSchedule(start, count, per, total);
    const status = approve ? "ACTIVE" : "PENDING";

    const loan = await prisma.loan.create({
      data: {
        employeeId,
        loanType: loanType || "ADVANCE",
        amount: total,
        installmentAmount: per,
        installments: count,
        paidInstallments: 0,
        remaining: total,
        startDeductDate: start,
        status,
        notes: notes || null,
        approvedById: approve ? session.userId : null,
        schedule: { create: schedule },
      },
      include: {
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
        schedule: { orderBy: { dueDate: "asc" } },
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "Loan",
      entityId: loan.id,
      action: "CREATE",
      newValue: { employeeId, amount: total, installments: count, status },
    });

    return NextResponse.json(loan, { status: 201 });
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
    if (!["APPROVED", "ACTIVE", "CANCELLED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    const existing = await prisma.loan.findFirst({
      where: { id, employee: { companyId: session.companyId } },
    });
    if (!existing) return NextResponse.json({ error: "القرض غير موجود" }, { status: 404 });

    const nextStatus = status === "APPROVED" ? "ACTIVE" : status;
    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: nextStatus,
        approvedById: ["APPROVED", "ACTIVE"].includes(status) ? session.userId : existing.approvedById,
      },
      include: {
        employee: { select: { id: true, employeeNumber: true, fullName: true } },
        schedule: { orderBy: { dueDate: "asc" } },
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "Loan",
      entityId: id,
      action: "UPDATE",
      oldValue: { status: existing.status },
      newValue: { status: nextStatus },
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
