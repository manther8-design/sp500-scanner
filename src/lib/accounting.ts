import { prisma } from "./prisma";
import { round2 } from "./utils";

export type JournalLineInput = {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
  costCenterId?: string | null;
};

export async function nextJournalNumber(companyId: string) {
  const count = await prisma.journalEntry.count({ where: { companyId } });
  return `JE-${String(count + 1).padStart(6, "0")}`;
}

export async function createJournalEntry(params: {
  companyId: string;
  branchId?: string | null;
  entryDate: Date;
  entryType: string;
  description?: string;
  reference?: string;
  sourceType?: string;
  sourceId?: string;
  lines: JournalLineInput[];
  createdById?: string;
  status?: "DRAFT" | "PENDING" | "APPROVED" | "POSTED";
}) {
  const totalDebit = round2(params.lines.reduce((s, l) => s + (l.debit || 0), 0));
  const totalCredit = round2(params.lines.reduce((s, l) => s + (l.credit || 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.009) {
    throw new Error(`القيد غير متوازن: مدين ${totalDebit} ≠ دائن ${totalCredit}`);
  }
  if (params.lines.length < 2) throw new Error("القيد يجب أن يحتوي على سطرين على الأقل");

  const entryNumber = await nextJournalNumber(params.companyId);
  const status = params.status || "DRAFT";

  return prisma.journalEntry.create({
    data: {
      companyId: params.companyId,
      branchId: params.branchId || null,
      entryNumber,
      entryDate: params.entryDate,
      entryType: params.entryType,
      description: params.description,
      reference: params.reference,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      totalDebit,
      totalCredit,
      status,
      createdById: params.createdById,
      postedAt: status === "POSTED" ? new Date() : null,
      postedById: status === "POSTED" ? params.createdById : null,
      lines: {
        create: params.lines.map((l, idx) => ({
          accountId: l.accountId,
          debit: round2(l.debit || 0),
          credit: round2(l.credit || 0),
          description: l.description,
          costCenterId: l.costCenterId || null,
          lineOrder: idx + 1,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function postJournal(entryId: string, userId?: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });
  if (!entry) throw new Error("القيد غير موجود");
  if (entry.status === "POSTED") throw new Error("القيد مرحّل مسبقاً");
  if (entry.status === "REVERSED") throw new Error("لا يمكن ترحيل قيد معكوس");
  if (Math.abs(entry.totalDebit - entry.totalCredit) > 0.009) {
    throw new Error("لا يمكن ترحيل قيد غير متوازن");
  }
  return prisma.journalEntry.update({
    where: { id: entryId },
    data: {
      status: "POSTED",
      postedAt: new Date(),
      postedById: userId,
    },
  });
}

export async function reverseJournal(entryId: string, userId?: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });
  if (!entry) throw new Error("القيد غير موجود");
  if (entry.status !== "POSTED") throw new Error("يمكن عكس القيود المرحلة فقط");

  const reversal = await createJournalEntry({
    companyId: entry.companyId,
    branchId: entry.branchId,
    entryDate: new Date(),
    entryType: "REVERSAL",
    description: `عكس القيد ${entry.entryNumber}`,
    reference: entry.entryNumber,
    sourceType: "JOURNAL_REVERSAL",
    sourceId: entry.id,
    createdById: userId,
    status: "POSTED",
    lines: entry.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,
      credit: l.debit,
      description: l.description || undefined,
      costCenterId: l.costCenterId,
    })),
  });

  await prisma.journalEntry.update({
    where: { id: entry.id },
    data: { status: "REVERSED", reversedOfId: reversal.id },
  });

  return reversal;
}

export async function getAccountBalance(accountId: string, asOf?: Date) {
  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      journal: {
        status: "POSTED",
        ...(asOf ? { entryDate: { lte: asOf } } : {}),
      },
    },
  });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  const nature = account?.nature || "DEBIT";
  const balance = nature === "DEBIT" ? debit - credit : credit - debit;
  return { debit, credit, balance: round2(balance), nature };
}

export async function trialBalance(companyId: string, from?: Date, to?: Date) {
  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true, isPostable: true },
    orderBy: { code: "asc" },
  });
  const result = [];
  for (const acc of accounts) {
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: acc.id,
        journal: {
          companyId,
          status: "POSTED",
          ...(from || to
            ? {
                entryDate: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      },
    });
    const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
    const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
    if (debit === 0 && credit === 0) continue;
    result.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit,
      credit,
    });
  }
  return result;
}

export async function incomeStatement(companyId: string, from: Date, to: Date) {
  const rows = await trialBalance(companyId, from, to);
  const revenue = rows.filter((r) => r.type === "REVENUE");
  const expense = rows.filter((r) => r.type === "EXPENSE");
  const totalRevenue = round2(revenue.reduce((s, r) => s + (r.credit - r.debit), 0));
  const totalExpense = round2(expense.reduce((s, r) => s + (r.debit - r.credit), 0));
  return {
    revenue,
    expense,
    totalRevenue,
    totalExpense,
    netIncome: round2(totalRevenue - totalExpense),
  };
}

export async function balanceSheet(companyId: string, asOf: Date) {
  const rows = await trialBalance(companyId, undefined, asOf);
  const assets = rows.filter((r) => r.type === "ASSET");
  const liabilities = rows.filter((r) => r.type === "LIABILITY");
  const equity = rows.filter((r) => r.type === "EQUITY");
  const totalAssets = round2(assets.reduce((s, r) => s + (r.debit - r.credit), 0));
  const totalLiabilities = round2(liabilities.reduce((s, r) => s + (r.credit - r.debit), 0));
  const totalEquity = round2(equity.reduce((s, r) => s + (r.credit - r.debit), 0));
  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
}

/** Find account by code within company */
export async function accountByCode(companyId: string, code: string) {
  return prisma.account.findUnique({ where: { companyId_code: { companyId, code } } });
}
