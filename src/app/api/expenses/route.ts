import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJournalEntry } from "@/lib/accounting";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where: { companyId: session.companyId },
      include: { category: true, branch: true, costCenter: true },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.expenseCategory.findMany({ where: { companyId: session.companyId } }),
  ]);
  return NextResponse.json({ expenses, categories });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();

  if (body.action === "approve") {
    const expense = await prisma.expense.findFirst({
      where: { id: body.id, companyId: session.companyId },
      include: { category: true },
    });
    if (!expense) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    if (!expense.category.accountId) {
      return NextResponse.json({ error: "التصنيف غير مربوط بحساب محاسبي" }, { status: 400 });
    }
    const bank = await prisma.account.findFirst({ where: { companyId: session.companyId, code: "1120" } });
    if (!bank) return NextResponse.json({ error: "حساب البنك غير موجود" }, { status: 400 });

    const journal = await createJournalEntry({
      companyId: session.companyId,
      branchId: expense.branchId,
      entryDate: expense.expenseDate,
      entryType: "EXPENSE",
      description: expense.description || expense.category.name,
      sourceType: "EXPENSE",
      sourceId: expense.id,
      createdById: session.userId,
      status: "POSTED",
      lines: [
        {
          accountId: expense.category.accountId,
          debit: expense.amount,
          credit: 0,
          costCenterId: expense.costCenterId,
        },
        { accountId: bank.id, debit: 0, credit: expense.amount },
      ],
    });

    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: { status: "POSTED", journalId: journal.id },
    });
    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "Expense",
      entityId: expense.id,
      action: "POST",
      newValue: { journalId: journal.id },
    });
    return NextResponse.json(updated);
  }

  const expense = await prisma.expense.create({
    data: {
      companyId: session.companyId,
      branchId: body.branchId || null,
      categoryId: body.categoryId,
      costCenterId: body.costCenterId || null,
      expenseDate: new Date(body.expenseDate || Date.now()),
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod || "BANK",
      beneficiary: body.beneficiary,
      description: body.description,
      status: "DRAFT",
      createdById: session.userId,
    },
  });
  return NextResponse.json(expense, { status: 201 });
}
