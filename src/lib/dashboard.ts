import { prisma } from "./prisma";
import { balanceSheet, incomeStatement } from "./accounting";
import { round2 } from "./utils";

export async function getDashboardData(companyId: string, year?: number, month?: number) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || now.getMonth() + 1;
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0, 23, 59, 59);
  const prevFrom = new Date(y, m - 2, 1);
  const prevTo = new Date(y, m - 1, 0, 23, 59, 59);

  const [income, sheet, prevIncome] = await Promise.all([
    incomeStatement(companyId, from, to),
    balanceSheet(companyId, to),
    incomeStatement(companyId, prevFrom, prevTo),
  ]);

  const cashAccounts = await prisma.account.findMany({
    where: { companyId, code: { in: ["1110", "1120"] } },
  });
  let cash = 0;
  let bank = 0;
  for (const acc of cashAccounts) {
    const lines = await prisma.journalLine.findMany({
      where: { accountId: acc.id, journal: { status: "POSTED", entryDate: { lte: to } } },
    });
    const bal = lines.reduce((s, l) => s + l.debit - l.credit, 0);
    if (acc.code === "1110") cash = bal;
    if (acc.code === "1120") bank = bal;
  }

  const ar = await prisma.account.findFirst({ where: { companyId, code: "1130" } });
  const ap = await prisma.account.findFirst({ where: { companyId, code: "2130" } });
  let receivables = 0;
  let payables = 0;
  if (ar) {
    const lines = await prisma.journalLine.findMany({
      where: { accountId: ar.id, journal: { status: "POSTED" } },
    });
    receivables = lines.reduce((s, l) => s + l.debit - l.credit, 0);
  }
  if (ap) {
    const lines = await prisma.journalLine.findMany({
      where: { accountId: ap.id, journal: { status: "POSTED" } },
    });
    payables = lines.reduce((s, l) => s + l.credit - l.debit, 0);
  }

  const employees = await prisma.employee.groupBy({
    by: ["employmentStatus"],
    where: { companyId },
    _count: true,
  });
  const empMap = Object.fromEntries(employees.map((e) => [e.employmentStatus, e._count]));

  const onLeave = await prisma.leaveRequest.count({
    where: {
      status: "APPROVED",
      startDate: { lte: now },
      endDate: { gte: now },
      employee: { companyId },
    },
  });

  const contractsExpiring = await prisma.employee.count({
    where: {
      companyId,
      employmentStatus: { in: ["ACTIVE", "PROBATION"] },
      contractEndDate: {
        lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        gte: now,
      },
    },
  });

  const unpaidPayroll = await prisma.payrollRun.aggregate({
    where: { companyId, status: { in: ["APPROVED", "CALCULATED"] } },
    _sum: { totalNet: true },
  });

  const latestPayroll = await prisma.payrollRun.findFirst({
    where: { companyId, status: { in: ["POSTED", "APPROVED", "CALCULATED", "PAID"] } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  // Monthly series for last 6 months
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const f = new Date(d.getFullYear(), d.getMonth(), 1);
    const t = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const inc = await incomeStatement(companyId, f, t);
    monthly.push({
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      revenue: inc.totalRevenue,
      expense: inc.totalExpense,
      profit: inc.netIncome,
    });
  }

  const expenseByAccount = income.expense.map((e) => ({
    name: e.name,
    value: round2(e.debit - e.credit),
  }));

  const branches = await prisma.branch.findMany({ where: { companyId, isActive: true } });
  const branchPerf = [];
  for (const b of branches) {
    const empCost = await prisma.employee.aggregate({
      where: { branchId: b.id, employmentStatus: { in: ["ACTIVE", "PROBATION"] } },
      _sum: { basicSalary: true },
      _count: true,
    });
    branchPerf.push({
      id: b.id,
      name: b.name,
      employees: empCost._count,
      salaryBase: empCost._sum.basicSalary || 0,
    });
  }

  const alerts = [];
  if (income.totalExpense > income.totalRevenue * 0.85 && income.totalRevenue > 0) {
    alerts.push({
      type: "warning",
      message: "المصروفات مرتفعة نسبةً إلى الإيرادات هذا الشهر",
    });
  }
  if (income.totalRevenue < prevIncome.totalRevenue * 0.9 && prevIncome.totalRevenue > 0) {
    alerts.push({ type: "warning", message: "انخفاض الإيرادات مقارنة بالشهر السابق" });
  }
  if ((cash + bank) < income.totalExpense * 0.5 && income.totalExpense > 0) {
    alerts.push({ type: "danger", message: "السيولة النقدية منخفضة نسبياً" });
  }
  if (contractsExpiring > 0) {
    alerts.push({
      type: "info",
      message: `${contractsExpiring} عقد/عقود قاربت على الانتهاء خلال 60 يوماً`,
    });
  }

  const payrollToRevenue =
    income.totalRevenue > 0 && latestPayroll
      ? round2((latestPayroll.totalGross / income.totalRevenue) * 100)
      : null;

  return {
    period: { year: y, month: m, from, to },
    financial: {
      revenue: income.totalRevenue,
      expenses: income.totalExpense,
      netIncome: income.netIncome,
      assets: sheet.totalAssets,
      liabilities: sheet.totalLiabilities,
      equity: sheet.totalEquity,
      cash: round2(cash),
      bank: round2(bank),
      receivables: round2(receivables),
      payables: round2(payables),
      cashFlowApprox: round2(income.netIncome),
      payrollGross: latestPayroll?.totalGross || 0,
      operatingExpenses: income.totalExpense,
    },
    hr: {
      active: (empMap.ACTIVE || 0) + (empMap.PROBATION || 0) + (empMap.ON_LEAVE || 0),
      probation: empMap.PROBATION || 0,
      terminated: (empMap.TERMINATED || 0) + (empMap.RESIGNED || 0),
      onLeave,
      contractsExpiring,
      unpaidPayroll: unpaidPayroll._sum.totalNet || 0,
    },
    charts: { monthly, expenseByAccount, branchPerf },
    kpis: {
      netProfitMargin:
        income.totalRevenue > 0 ? round2((income.netIncome / income.totalRevenue) * 100) : 0,
      payrollToRevenue,
      currentRatio:
        sheet.totalLiabilities > 0 ? round2(sheet.totalAssets / sheet.totalLiabilities) : null,
    },
    alerts,
    prevNetIncome: prevIncome.netIncome,
  };
}
