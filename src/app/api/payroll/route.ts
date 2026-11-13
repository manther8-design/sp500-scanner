import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAudit } from "@/lib/auth";
import {
  calculatePayrollRun,
  approvePayrollRun,
  postPayrollToAccounting,
} from "@/lib/payroll";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;

  if (id) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        items: {
          include: { employee: { select: { id: true, employeeNumber: true, fullName: true } } },
          orderBy: { employee: { employeeNumber: "asc" } },
        },
      },
    });
    if (!run) return NextResponse.json({ error: "المسير غير موجود" }, { status: 404 });
    return NextResponse.json(run);
  }

  const runs = await prisma.payrollRun.findMany({
    where: {
      companyId: session.companyId,
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
    },
    include: {
      items: {
        include: { employee: { select: { id: true, employeeNumber: true, fullName: true } } },
        orderBy: { employee: { employeeNumber: "asc" } },
      },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(runs);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "calculate") {
      const year = Number(body.year);
      const month = Number(body.month);
      if (!year || !month) {
        return NextResponse.json({ error: "السنة والشهر مطلوبان" }, { status: 400 });
      }
      const run = await calculatePayrollRun({
        companyId: session.companyId,
        year,
        month,
        createdById: session.userId,
      });
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "PayrollRun",
        entityId: run.id,
        action: "CALCULATE",
        newValue: { year, month, totalNet: run.totalNet },
      });
      return NextResponse.json(run);
    }

    if (action === "approve") {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "معرّف المسير مطلوب" }, { status: 400 });
      const existing = await prisma.payrollRun.findFirst({
        where: { id, companyId: session.companyId },
      });
      if (!existing) return NextResponse.json({ error: "المسير غير موجود" }, { status: 404 });
      const run = await approvePayrollRun(id, session.userId);
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "PayrollRun",
        entityId: id,
        action: "APPROVE",
      });
      return NextResponse.json(run);
    }

    if (action === "post") {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "معرّف المسير مطلوب" }, { status: 400 });
      const existing = await prisma.payrollRun.findFirst({
        where: { id, companyId: session.companyId },
      });
      if (!existing) return NextResponse.json({ error: "المسير غير موجود" }, { status: 404 });
      const run = await postPayrollToAccounting(id, session.userId);
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "PayrollRun",
        entityId: id,
        action: "POST",
        newValue: { journalId: run.journalId },
      });
      return NextResponse.json(run);
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
