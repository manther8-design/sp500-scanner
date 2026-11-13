import { prisma } from "./prisma";
import { evaluateFormula } from "./formula-engine";
import { createJournalEntry } from "./accounting";
import { round2 } from "./utils";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function monthRange(year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  return { from, to };
}

export async function calculatePayrollRun(params: {
  companyId: string;
  year: number;
  month: number;
  createdById?: string;
}) {
  const { companyId, year, month } = params;
  const existing = await prisma.payrollRun.findFirst({
    where: { companyId, year, month, status: { in: ["APPROVED", "POSTED", "PAID"] } },
  });
  if (existing) {
    throw new Error("يوجد مسير رواتب معتمد/مرحّل لهذه الفترة ولا يمكن إعادة احتسابه");
  }

  const policy =
    (await prisma.workPolicy.findFirst({ where: { companyId, isDefault: true, isActive: true } })) ||
    (await prisma.workPolicy.findFirst({ where: { companyId, isActive: true } }));

  const saudi = await prisma.saudiComplianceSettings.findUnique({ where: { companyId } });
  const monthlyHours = policy?.monthlyHours || 176;
  const { from, to } = monthRange(year, month);
  const monthDays = daysInMonth(year, month);

  const formulas = await prisma.formulaDefinition.findMany({
    where: {
      companyId,
      isActive: true,
      effectiveFrom: { lte: to },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
    },
    orderBy: [{ version: "desc" }],
  });
  const formulaByCategory = (cat: string) => formulas.find((f) => f.category === cat);

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      employmentStatus: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] },
    },
    include: {
      allowances: { where: { isActive: true }, include: { allowanceType: true } },
      loans: { where: { status: "ACTIVE" }, include: { schedule: true } },
      incentives: {
        where: {
          status: "APPROVED",
          paidInPayrollId: null,
        },
        include: { incentiveType: true },
      },
      overtime: {
        where: {
          status: "APPROVED",
          workDate: { gte: from, lte: to },
        },
      },
      attendance: {
        where: { workDate: { gte: from, lte: to } },
      },
    },
  });

  const draft = await prisma.payrollRun.findFirst({
    where: { companyId, year, month, status: { in: ["DRAFT", "CALCULATED"] } },
  });
  if (draft) {
    await prisma.payrollItem.deleteMany({ where: { payrollRunId: draft.id } });
    await prisma.payrollRun.delete({ where: { id: draft.id } });
  }

  const runNumber = `PR-${year}${String(month).padStart(2, "0")}`;
  const run = await prisma.payrollRun.create({
    data: {
      companyId,
      year,
      month,
      runNumber,
      status: "CALCULATED",
      calculatedAt: new Date(),
    },
  });

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const emp of employees) {
    const basic = emp.basicSalary || 0;
    let totalAllowances = 0;
    const allowanceLines: { code: string; name: string; amount: number }[] = [];
    let housing = 0;
    let transport = 0;
    let otBaseAllowances = 0;

    for (const a of emp.allowances) {
      const method = a.calcMethod || a.allowanceType.calcMethod;
      const amount =
        method === "PERCENT" ? round2((basic * a.value) / 100) : round2(a.value);
      totalAllowances += amount;
      allowanceLines.push({
        code: a.allowanceType.code,
        name: a.allowanceType.name,
        amount,
      });
      if (a.allowanceType.code === "HOUSING") housing = amount;
      if (a.allowanceType.code === "TRANSPORT") transport = amount;
      if (a.allowanceType.includeInOt) otBaseAllowances += amount;
    }

    const absentDays = emp.attendance.filter((r) => r.status === "ABSENT").length;
    const lateMinutes = emp.attendance.reduce((s, r) => s + r.lateMinutes, 0);
    const lateHours = lateMinutes / 60;
    const workingDays = emp.attendance.filter((r) =>
      ["PRESENT", "HALF_DAY"].includes(r.status),
    ).length;
    const otHours = emp.overtime.reduce((s, o) => s + o.hours, 0);

    const hourRate = monthlyHours > 0 ? basic / monthlyHours : 0;
    const dayRate = monthDays > 0 ? basic / monthDays : 0;

    const otBaseMode = policy?.otBase || "BASIC";
    let otBase = basic;
    if (otBaseMode === "BASIC_HOUSING") otBase = basic + housing;
    if (otBaseMode === "TOTAL") otBase = basic + totalAllowances;
    if (otBaseMode === "BASIC" && otBaseAllowances) otBase = basic + otBaseAllowances;

    const otFormula = formulaByCategory("OVERTIME");
    let totalOvertime = 0;
    const otLines: unknown[] = [];
    for (const ot of emp.overtime) {
      const factor =
        ot.factor ||
        (ot.otType === "WEEKEND"
          ? policy?.otWeekendFactor || 2
          : ot.otType === "HOLIDAY"
            ? policy?.otHolidayFactor || 2.5
            : ot.otType === "NIGHT"
              ? policy?.otNightFactor || 1.5
              : policy?.otWeekdayFactor || 1.5);
      const ctx = {
        basic_salary: basic,
        ot_base: otBase,
        monthly_hours: monthlyHours,
        ot_hours: ot.hours,
        ot_factor: factor,
        hour_rate: otBase / monthlyHours,
        housing_allowance: housing,
        transport_allowance: transport,
        total_salary: basic + totalAllowances,
      };
      const expression =
        otFormula?.expression || "round((ot_base / monthly_hours) * ot_hours * ot_factor, 2)";
      const amount = round2(evaluateFormula(expression, ctx));
      totalOvertime += amount;
      otLines.push({
        id: ot.id,
        hours: ot.hours,
        factor,
        amount,
        expression,
        formulaVersion: otFormula?.version || null,
      });
      if (otFormula) {
        await prisma.formulaSnapshot.create({
          data: {
            formulaId: otFormula.id,
            expression,
            version: otFormula.version,
            usedInType: "OVERTIME",
            usedInId: ot.id,
          },
        });
      }
    }

    const incentivesAmount = round2(
      emp.incentives.reduce((s, i) => s + i.amount, 0),
    );

    // Deductions via formulas
    const absenceFormula = formulaByCategory("ABSENCE");
    const lateFormula = formulaByCategory("LATE");
    const absenceExpr =
      absenceFormula?.expression || "round((basic_salary / month_days) * absent_days, 2)";
    const lateExpr =
      lateFormula?.expression ||
      "round((basic_salary / monthly_hours) * late_hours * IF(late_hours > 2, 1.1, 1), 2)";

    const dedCtx = {
      basic_salary: basic,
      total_salary: basic + totalAllowances,
      month_days: monthDays,
      monthly_hours: monthlyHours,
      absent_days: absentDays,
      late_hours: lateHours,
      late_minutes: lateMinutes,
      hour_rate: hourRate,
      day_rate: dayRate,
      working_days: workingDays || monthDays,
    };

    const absenceDed = absentDays > 0 ? round2(evaluateFormula(absenceExpr, dedCtx)) : 0;
    const lateDed = lateHours > 0 ? round2(evaluateFormula(lateExpr, dedCtx)) : 0;

    if (absenceFormula && absentDays > 0) {
      await prisma.formulaSnapshot.create({
        data: {
          formulaId: absenceFormula.id,
          expression: absenceExpr,
          version: absenceFormula.version,
          usedInType: "PAYROLL_ABSENCE",
          usedInId: `${run.id}:${emp.id}`,
        },
      });
    }
    if (lateFormula && lateHours > 0) {
      await prisma.formulaSnapshot.create({
        data: {
          formulaId: lateFormula.id,
          expression: lateExpr,
          version: lateFormula.version,
          usedInType: "PAYROLL_LATE",
          usedInId: `${run.id}:${emp.id}`,
        },
      });
    }

    let loanDeduction = 0;
    for (const loan of emp.loans) {
      const next = loan.schedule.find((s) => s.status === "PENDING");
      if (next) loanDeduction += next.amount;
    }
    loanDeduction = round2(loanDeduction);

    const gross = round2(basic + totalAllowances + totalOvertime + incentivesAmount);
    const gosiBase = round2(basic + housing); // typical SA GOSI base: basic+housing
    const gosiEmpRate = saudi?.gosiEmployeeRate ?? 9.75;
    const gosiErRate = saudi?.gosiEmployerRate ?? 11.75;
    const gosiEmployee = emp.gosiExempt ? 0 : round2((gosiBase * gosiEmpRate) / 100);
    const gosiEmployer = emp.gosiExempt ? 0 : round2((gosiBase * gosiErRate) / 100);

    const deductions = round2(absenceDed + lateDed + loanDeduction + gosiEmployee);
    const net = round2(gross - deductions);

    const breakdown = {
      allowances: allowanceLines,
      overtime: otLines,
      incentives: emp.incentives.map((i) => ({
        id: i.id,
        name: i.incentiveType.name,
        amount: i.amount,
      })),
      deductions: {
        absence: { amount: absenceDed, expression: absenceExpr },
        late: { amount: lateDed, expression: lateExpr },
        loan: loanDeduction,
        gosiEmployee,
        gosiEmployer,
      },
      context: dedCtx,
      effectiveFormulas: {
        overtime: otFormula?.id,
        absence: absenceFormula?.id,
        late: lateFormula?.id,
      },
    };

    await prisma.payrollItem.create({
      data: {
        payrollRunId: run.id,
        employeeId: emp.id,
        basicSalary: basic,
        totalAllowances,
        totalOvertime,
        totalIncentives: incentivesAmount,
        grossSalary: gross,
        totalDeductions: deductions,
        gosiEmployee,
        gosiEmployer,
        loanDeduction,
        netSalary: net,
        workingDays,
        absentDays,
        lateHours,
        otHours,
        breakdownJson: JSON.stringify(breakdown),
        status: "CALCULATED",
      },
    });

    totalGross += gross;
    totalDeductions += deductions;
    totalNet += net;
  }

  return prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      totalGross: round2(totalGross),
      totalDeductions: round2(totalDeductions),
      totalNet: round2(totalNet),
    },
    include: {
      items: {
        include: { employee: true },
        orderBy: { employee: { employeeNumber: "asc" } },
      },
    },
  });
}

export async function approvePayrollRun(runId: string, userId: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("مسير الرواتب غير موجود");
  if (run.status !== "CALCULATED") throw new Error("يمكن اعتماد المسيرات المحسوبة فقط");
  return prisma.payrollRun.update({
    where: { id: runId },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: userId },
  });
}

export async function postPayrollToAccounting(runId: string, userId?: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    include: { items: true, company: true },
  });
  if (!run) throw new Error("مسير الرواتب غير موجود");
  if (run.status !== "APPROVED") throw new Error("يجب اعتماد المسير قبل الترحيل المحاسبي");
  if (run.journalId) throw new Error("تم ترحيل المسير محاسبياً مسبقاً");

  const salaryExp = await prisma.account.findFirst({
    where: { companyId: run.companyId, code: "5100" },
  });
  const gosiExp = await prisma.account.findFirst({
    where: { companyId: run.companyId, code: "5110" },
  });
  const payable = await prisma.account.findFirst({
    where: { companyId: run.companyId, code: "2100" },
  });
  const gosiPay = await prisma.account.findFirst({
    where: { companyId: run.companyId, code: "2110" },
  });
  if (!salaryExp || !payable || !gosiExp || !gosiPay) {
    throw new Error("حسابات الرواتب غير مكتملة في دليل الحسابات");
  }

  const gross = run.totalGross;
  const gosiEr = round2(run.items.reduce((s, i) => s + i.gosiEmployer, 0));
  const gosiEmp = round2(run.items.reduce((s, i) => s + i.gosiEmployee, 0));
  const otherDed = round2(run.totalDeductions - gosiEmp);
  const net = run.totalNet;

  const lines = [
    { accountId: salaryExp.id, debit: gross, credit: 0, description: "رواتب وأجور" },
    { accountId: gosiExp.id, debit: gosiEr, credit: 0, description: "حصة المنشأة تأمينات" },
    {
      accountId: payable.id,
      debit: 0,
      credit: net + otherDed,
      description: "صافي الرواتب المستحقة",
    },
    {
      accountId: gosiPay.id,
      debit: 0,
      credit: gosiEmp + gosiEr,
      description: "تأمينات مستحقة",
    },
  ].filter((l) => l.debit > 0 || l.credit > 0);

  // balance check: adjust payable if needed for float
  const journal = await createJournalEntry({
    companyId: run.companyId,
    entryDate: new Date(run.year, run.month, 0),
    entryType: "PAYROLL",
    description: `مسير رواتب ${run.runNumber}`,
    reference: run.runNumber,
    sourceType: "PAYROLL_RUN",
    sourceId: run.id,
    createdById: userId,
    status: "POSTED",
    lines,
  });

  // Mark incentives as paid in this run
  for (const item of run.items) {
    await prisma.employeeIncentive.updateMany({
      where: {
        employeeId: item.employeeId,
        status: "APPROVED",
        paidInPayrollId: null,
      },
      data: { paidInPayrollId: run.id, status: "PAID" },
    });
    // loan installments
    if (item.loanDeduction > 0) {
      const loans = await prisma.loan.findMany({
        where: { employeeId: item.employeeId, status: "ACTIVE" },
        include: { schedule: true },
      });
      let remaining = item.loanDeduction;
      for (const loan of loans) {
        const next = loan.schedule.find((s) => s.status === "PENDING");
        if (!next || remaining <= 0) continue;
        const pay = Math.min(remaining, next.amount);
        await prisma.loanInstallment.update({
          where: { id: next.id },
          data: {
            paidAmount: pay,
            status: "PAID",
            payrollItemId: item.id,
          },
        });
        const newRemaining = round2(loan.remaining - pay);
        await prisma.loan.update({
          where: { id: loan.id },
          data: {
            remaining: newRemaining,
            paidInstallments: loan.paidInstallments + 1,
            status: newRemaining <= 0 ? "COMPLETED" : "ACTIVE",
          },
        });
        remaining = round2(remaining - pay);
      }
    }
  }

  return prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: "POSTED", journalId: journal.id, postedAt: new Date() },
  });
}
