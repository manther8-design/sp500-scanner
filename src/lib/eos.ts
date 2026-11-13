import { prisma } from "./prisma";
import { evaluateFormula } from "./formula-engine";
import { createJournalEntry } from "./accounting";
import { round2 } from "./utils";

/**
 * End-of-service settlement with configurable Saudi Labor Law-style rules.
 * Rules live in EosPolicy.rulesJson — not hard-coded as immutable law.
 */
export async function calculateTermination(params: {
  employeeId: string;
  lastWorkDate: Date;
  reason: string;
  otherDues?: number;
  extraDeductions?: number;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: {
      allowances: { where: { isActive: true }, include: { allowanceType: true } },
      leaveBalances: { include: { leaveType: true } },
      loans: { where: { status: { in: ["ACTIVE", "APPROVED"] } } },
    },
  });
  if (!employee) throw new Error("الموظف غير موجود");
  if (!employee.hireDate && !employee.startDate) {
    throw new Error("تاريخ التوظيف غير محدد");
  }

  const start = employee.startDate || employee.hireDate!;
  const end = params.lastWorkDate;
  const ms = end.getTime() - start.getTime();
  const serviceYears = ms / (1000 * 60 * 60 * 24 * 365.25);
  const serviceMonths = serviceYears * 12;

  const housing =
    employee.allowances.find((a) => a.allowanceType.code === "HOUSING")?.value || 0;
  const eosAllowances = employee.allowances
    .filter((a) => a.allowanceType.subjectToEos)
    .reduce((s, a) => s + a.value, 0);
  const salaryForEos = round2(employee.basicSalary + eosAllowances);

  const policy =
    (await prisma.eosPolicy.findFirst({
      where: { companyId: employee.companyId, isDefault: true, isActive: true },
    })) ||
    (await prisma.eosPolicy.findFirst({
      where: { companyId: employee.companyId, isActive: true },
    }));

  type EosRule = { formula: string; description?: string };
  const rules: Record<string, EosRule> = policy?.rulesJson
    ? (JSON.parse(policy.rulesJson) as Record<string, EosRule>)
    : (defaultSaudiRules() as Record<string, EosRule>);

  const rule = rules[params.reason] || rules.DEFAULT || defaultSaudiRules().DEFAULT;
  const formula =
    (await prisma.formulaDefinition.findFirst({
      where: {
        companyId: employee.companyId,
        category: "EOS",
        isActive: true,
      },
      orderBy: { version: "desc" },
    })) || null;

  const expression = formula?.expression || rule.formula;
  const ctx = {
    basic_salary: employee.basicSalary,
    total_salary: salaryForEos,
    housing_allowance: housing,
    service_years: serviceYears,
    service_months: serviceMonths,
    fixed_value: salaryForEos,
  };

  const eosAmount = round2(Math.max(0, evaluateFormula(expression, ctx)));

  const leaveBal = employee.leaveBalances
    .filter((b) => b.leaveType.isPaid)
    .reduce((s, b) => s + b.remaining, 0);
  const dayRate = salaryForEos / 30;
  const leavePay = round2(leaveBal * dayRate);

  const loanRemaining = round2(employee.loans.reduce((s, l) => s + l.remaining, 0));
  const otherDues = params.otherDues || 0;
  const deductions = round2(loanRemaining + (params.extraDeductions || 0));
  const netSettlement = round2(eosAmount + leavePay + otherDues - deductions);

  const calculation = {
    startDate: start.toISOString(),
    lastWorkDate: end.toISOString(),
    serviceYears,
    serviceMonths,
    salaryForEos,
    expression,
    formulaVersion: formula?.version || null,
    policyId: policy?.id || null,
    ruleDescription: rule.description,
    context: ctx,
    leaveBalanceDays: leaveBal,
    leavePay,
    eosAmount,
    otherDues,
    deductions,
    loanRemaining,
    netSettlement,
  };

  if (formula) {
    await prisma.formulaSnapshot.create({
      data: {
        formulaId: formula.id,
        expression,
        version: formula.version,
        usedInType: "EOS",
        usedInId: employee.id,
      },
    });
  }

  return prisma.termination.create({
    data: {
      employeeId: employee.id,
      lastWorkDate: end,
      reason: params.reason,
      contractType: employee.contractType,
      salaryForEos,
      leaveBalanceDays: leaveBal,
      leavePay,
      eosAmount,
      otherDues,
      deductions,
      netSettlement,
      calculationJson: JSON.stringify(calculation),
      status: "DRAFT",
    },
  });
}

export function defaultSaudiRules() {
  // Configurable templates inspired by Saudi Labor Law patterns — editable in DB
  return {
    CONTRACT_END: {
      description: "انتهاء العقد — نصف شهر عن كل سنة من الخمس الأولى ثم شهر كامل",
      formula:
        "IF(service_years <= 5, (fixed_value / 2) * service_years, (fixed_value / 2) * 5 + fixed_value * (service_years - 5))",
    },
    RESIGNATION: {
      description: "استقالة — وفق شرائح مدة الخدمة (قابلة للتهيئة)",
      formula:
        "IF(service_years < 2, 0, IF(service_years < 5, ((fixed_value / 2) * service_years) * 1/3, IF(service_years < 10, ((fixed_value / 2) * 5 + fixed_value * (service_years - 5)) * 2/3, (fixed_value / 2) * 5 + fixed_value * (service_years - 5))))",
    },
    TERMINATION: {
      description: "إنهاء من قبل المنشأة",
      formula:
        "IF(service_years <= 5, (fixed_value / 2) * service_years, (fixed_value / 2) * 5 + fixed_value * (service_years - 5))",
    },
    MUTUAL: {
      description: "اتفاق الطرفين",
      formula:
        "IF(service_years <= 5, (fixed_value / 2) * service_years, (fixed_value / 2) * 5 + fixed_value * (service_years - 5))",
    },
    DEFAULT: {
      description: "افتراضي",
      formula:
        "IF(service_years <= 5, (fixed_value / 2) * service_years, (fixed_value / 2) * 5 + fixed_value * (service_years - 5))",
    },
  };
}

export async function approveAndPostTermination(terminationId: string, userId?: string) {
  const t = await prisma.termination.findUnique({
    where: { id: terminationId },
    include: { employee: true },
  });
  if (!t) throw new Error("تسوية غير موجودة");
  if (t.status === "POSTED") throw new Error("مرحّلة مسبقاً");

  const eosExp = await prisma.account.findFirst({
    where: { companyId: t.employee.companyId, code: "5200" },
  });
  const payable = await prisma.account.findFirst({
    where: { companyId: t.employee.companyId, code: "2120" },
  });
  if (!eosExp || !payable) throw new Error("حسابات نهاية الخدمة غير موجودة");

  let journalId: string | null = null;
  if (t.netSettlement > 0) {
    const journal = await createJournalEntry({
      companyId: t.employee.companyId,
      entryDate: t.lastWorkDate,
      entryType: "AUTO",
      description: `تسوية نهاية خدمة — ${t.employee.fullName}`,
      sourceType: "TERMINATION",
      sourceId: t.id,
      createdById: userId,
      status: "POSTED",
      lines: [
        { accountId: eosExp.id, debit: t.netSettlement, credit: 0 },
        { accountId: payable.id, debit: 0, credit: t.netSettlement },
      ],
    });
    journalId = journal.id;
  }

  await prisma.employee.update({
    where: { id: t.employeeId },
    data: { employmentStatus: t.reason === "RESIGNATION" ? "RESIGNED" : "TERMINATED" },
  });

  await prisma.employeeStatusHistory.create({
    data: {
      employeeId: t.employeeId,
      changeType: "TERMINATE",
      oldValue: "ACTIVE",
      newValue: t.reason,
      effectiveDate: t.lastWorkDate,
      reason: `تسوية نهاية خدمة صافي ${t.netSettlement}`,
      changedById: userId,
    },
  });

  return prisma.termination.update({
    where: { id: t.id },
    data: {
      status: "POSTED",
      journalId,
      approvedById: userId,
      approvedAt: new Date(),
      serviceCertificateIssued: true,
    },
  });
}
