import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountByCode, createJournalEntry, postJournal } from "@/lib/accounting";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!hasPermission(session, "expenses.approve")) {
    return NextResponse.json({ error: "ليس لديك صلاحية الاعتماد" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const expense = await prisma.expense.findFirst({
    where: { id, companyId: session.companyId },
    include: { category: true },
  });

  if (!expense) return NextResponse.json({ error: "المصروف غير موجود" }, { status: 404 });
  if (!["DRAFT", "PENDING"].includes(expense.status)) {
    return NextResponse.json({ error: "لا يمكن اعتماد هذا المصروف" }, { status: 400 });
  }
  if (!expense.category.accountId) {
    return NextResponse.json({ error: "فئة المصروف غير مربوطة بحساب محاسبي" }, { status: 400 });
  }

  const bankAccount = await accountByCode(session.companyId, "1120");
  if (!bankAccount) {
    return NextResponse.json({ error: "حساب البنك 1120 غير موجود" }, { status: 400 });
  }

  try {
    const journal = await createJournalEntry({
      companyId: session.companyId,
      branchId: expense.branchId,
      entryDate: expense.expenseDate,
      entryType: "EXPENSE",
      description: expense.description || `مصروف: ${expense.category.name}`,
      reference: expense.id,
      sourceType: "EXPENSE",
      sourceId: expense.id,
      createdById: session.userId,
      status: "DRAFT",
      lines: [
        {
          accountId: expense.category.accountId,
          debit: expense.amount,
          credit: 0,
          description: expense.description || expense.category.name,
          costCenterId: expense.costCenterId,
        },
        {
          accountId: bankAccount.id,
          debit: 0,
          credit: expense.amount,
          description: `دفع مصروف — بنك`,
        },
      ],
    });

    await postJournal(journal.id, session.userId);

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        status: "POSTED",
        journalId: journal.id,
      },
      include: {
        category: { select: { id: true, code: true, name: true, accountId: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "Expense",
      entityId: id,
      action: "APPROVE",
      newValue: { status: "POSTED", journalId: journal.id },
    });

    return NextResponse.json({ expense: updated, journal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل اعتماد المصروف";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
