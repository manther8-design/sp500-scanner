import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultSaudiRules } from "../src/lib/eos";

const prisma = new PrismaClient();

const PERMISSIONS = [
  ["dashboard.view", "dashboard", "view"],
  ["accounting.accounts.view", "accounting", "view"],
  ["accounting.accounts.manage", "accounting", "update"],
  ["accounting.journal.view", "accounting", "view"],
  ["accounting.journal.create", "accounting", "create"],
  ["accounting.journal.approve", "accounting", "approve"],
  ["accounting.journal.post", "accounting", "post"],
  ["sales.view", "sales", "view"],
  ["sales.manage", "sales", "update"],
  ["purchases.view", "purchases", "view"],
  ["purchases.manage", "purchases", "update"],
  ["expenses.view", "expenses", "view"],
  ["expenses.manage", "expenses", "update"],
  ["expenses.approve", "expenses", "approve"],
  ["banking.view", "banking", "view"],
  ["banking.manage", "banking", "update"],
  ["hr.employees.view", "hr", "view"],
  ["hr.employees.manage", "hr", "update"],
  ["hr.attendance.view", "hr", "view"],
  ["hr.attendance.manage", "hr", "update"],
  ["payroll.view", "payroll", "view"],
  ["payroll.manage", "payroll", "update"],
  ["payroll.approve", "payroll", "approve"],
  ["payroll.post", "payroll", "post"],
  ["formulas.manage", "formulas", "update"],
  ["reports.view", "reports", "view"],
  ["reports.export", "reports", "export"],
  ["analytics.view", "analytics", "view"],
  ["settings.manage", "settings", "update"],
  ["users.manage", "users", "update"],
  ["employee.self", "portal", "view"],
];

async function main() {
  console.log("🌱 Seeding Smart ERP...");

  await prisma.formulaSnapshot.deleteMany();
  await prisma.payrollItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.termination.deleteMany();
  await prisma.loanInstallment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.overtimeRequest.deleteMany();
  await prisma.attendanceAmendment.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.employeeIncentive.deleteMany();
  await prisma.employeeAllowance.deleteMany();
  await prisma.employeeDeduction.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.employmentContract.deleteMany();
  await prisma.employeeStatusHistory.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.invoicePayment.deleteMany();
  await prisma.salesInvoiceLine.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.purchaseInvoiceLine.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.bankReconciliation.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.cashBox.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.account.deleteMany();
  await prisma.formulaDefinition.deleteMany();
  await prisma.allowanceType.deleteMany();
  await prisma.deductionType.deleteMany();
  await prisma.incentiveType.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.workPolicy.deleteMany();
  await prisma.eosPolicy.deleteMany();
  await prisma.saudiComplianceSettings.deleteMany();
  await prisma.costCenter.deleteMany();
  await prisma.department.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userCompany.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();
  await prisma.organization.deleteMany();

  for (const [code, module, action] of PERMISSIONS) {
    await prisma.permission.create({
      data: { code, module, action, description: code },
    });
  }
  const allPerms = await prisma.permission.findMany();

  const org = await prisma.organization.create({
    data: { name: "مجموعة النخبة", nameEn: "Elite Group" },
  });

  const company = await prisma.company.create({
    data: {
      organizationId: org.id,
      code: "ELITE",
      name: "شركة النخبة للخدمات",
      nameEn: "Elite Services Co.",
      commercialReg: "1010123456",
      taxNumber: "300012345600003",
      currency: "SAR",
      country: "SA",
    },
  });

  const branchRiyadh = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: "RYD",
      name: "فرع الرياض",
      address: "الرياض — حي العليا",
    },
  });
  const branchJeddah = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: "JED",
      name: "فرع جدة",
      address: "جدة — حي الزهراء",
    },
  });

  const deptHR = await prisma.department.create({
    data: { companyId: company.id, branchId: branchRiyadh.id, code: "HR", name: "الموارد البشرية" },
  });
  const deptFin = await prisma.department.create({
    data: { companyId: company.id, branchId: branchRiyadh.id, code: "FIN", name: "المالية" },
  });
  const deptOps = await prisma.department.create({
    data: { companyId: company.id, branchId: branchJeddah.id, code: "OPS", name: "العمليات" },
  });

  const ccAdmin = await prisma.costCenter.create({
    data: { companyId: company.id, branchId: branchRiyadh.id, code: "CC-ADM", name: "الإدارة العامة", type: "DEPARTMENT" },
  });
  const ccOps = await prisma.costCenter.create({
    data: { companyId: company.id, branchId: branchJeddah.id, code: "CC-OPS", name: "عمليات جدة", type: "BRANCH" },
  });

  // Roles
  const roleDefs = [
    { code: "SUPER_ADMIN", name: "مدير النظام", all: true },
    { code: "COMPANY_OWNER", name: "مالك الشركة", all: true },
    { code: "FINANCE_MANAGER", name: "المدير المالي", modules: ["dashboard", "accounting", "sales", "purchases", "expenses", "banking", "reports", "analytics"] },
    { code: "ACCOUNTANT", name: "محاسب", modules: ["dashboard", "accounting", "sales", "purchases", "expenses", "banking", "reports"] },
    { code: "HR_MANAGER", name: "مدير الموارد البشرية", modules: ["dashboard", "hr", "payroll", "formulas", "reports"] },
    { code: "PAYROLL_OFFICER", name: "مسؤول الرواتب", modules: ["dashboard", "payroll", "hr", "formulas"] },
    { code: "BRANCH_MANAGER", name: "مدير الفرع", modules: ["dashboard", "hr", "expenses", "reports"] },
    { code: "EMPLOYEE", name: "موظف", codes: ["employee.self", "dashboard.view"] },
  ];

  const roles: Record<string, string> = {};
  for (const r of roleDefs) {
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        code: r.code,
        name: r.name,
        isSystem: true,
      },
    });
    roles[r.code] = role.id;
    let perms = allPerms;
    if (!r.all) {
      if ("codes" in r && r.codes) {
        perms = allPerms.filter((p) => r.codes!.includes(p.code));
      } else if ("modules" in r && r.modules) {
        perms = allPerms.filter((p) => r.modules!.includes(p.module) || p.code === "dashboard.view");
      }
    }
    for (const p of perms) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }
  }

  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "admin@elite.sa",
      passwordHash,
      fullName: "مدير النظام",
      phone: "0500000001",
    },
  });
  await prisma.userCompany.create({
    data: { userId: admin.id, companyId: company.id, isDefault: true },
  });
  await prisma.userRole.create({
    data: { userId: admin.id, roleId: roles.SUPER_ADMIN },
  });

  const hrUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "hr@elite.sa",
      passwordHash: await bcrypt.hash("Hr@12345", 12),
      fullName: "سارة العتيبي",
    },
  });
  await prisma.userCompany.create({
    data: { userId: hrUser.id, companyId: company.id, isDefault: true },
  });
  await prisma.userRole.create({
    data: { userId: hrUser.id, roleId: roles.HR_MANAGER },
  });

  // Chart of Accounts
  const accounts = [
    ["1000", "الأصول", "ASSET", "DEBIT", null, false],
    ["1100", "الأصول المتداولة", "ASSET", "DEBIT", "1000", false],
    ["1110", "الصندوق", "ASSET", "DEBIT", "1100", true],
    ["1120", "البنك", "ASSET", "DEBIT", "1100", true],
    ["1130", "الذمم المدينة", "ASSET", "DEBIT", "1100", true],
    ["1140", "المخزون", "ASSET", "DEBIT", "1100", true],
    ["1200", "الأصول غير المتداولة", "ASSET", "DEBIT", "1000", false],
    ["1210", "الأثاث والمعدات", "ASSET", "DEBIT", "1200", true],
    ["2000", "الالتزامات", "LIABILITY", "CREDIT", null, false],
    ["2100", "رواتب مستحقة", "LIABILITY", "CREDIT", "2000", true],
    ["2110", "تأمينات مستحقة", "LIABILITY", "CREDIT", "2000", true],
    ["2120", "مستحقات نهاية الخدمة", "LIABILITY", "CREDIT", "2000", true],
    ["2130", "الذمم الدائنة", "LIABILITY", "CREDIT", "2000", true],
    ["2140", "ضريبة القيمة المضافة", "LIABILITY", "CREDIT", "2000", true],
    ["3000", "حقوق الملكية", "EQUITY", "CREDIT", null, false],
    ["3100", "رأس المال", "EQUITY", "CREDIT", "3000", true],
    ["3200", "الأرباح المحتجزة", "EQUITY", "CREDIT", "3000", true],
    ["4000", "الإيرادات", "REVENUE", "CREDIT", null, false],
    ["4100", "إيرادات المبيعات", "REVENUE", "CREDIT", "4000", true],
    ["4200", "إيرادات الخدمات", "REVENUE", "CREDIT", "4000", true],
    ["5000", "المصروفات", "EXPENSE", "DEBIT", null, false],
    ["5100", "الرواتب والأجور", "EXPENSE", "DEBIT", "5000", true],
    ["5110", "تأمينات اجتماعية (حصة المنشأة)", "EXPENSE", "DEBIT", "5000", true],
    ["5200", "مكافآت نهاية الخدمة", "EXPENSE", "DEBIT", "5000", true],
    ["5300", "الإيجارات", "EXPENSE", "DEBIT", "5000", true],
    ["5400", "الكهرباء والمياه", "EXPENSE", "DEBIT", "5000", true],
    ["5500", "الوقود", "EXPENSE", "DEBIT", "5000", true],
    ["5600", "الاتصالات", "EXPENSE", "DEBIT", "5000", true],
    ["5700", "الصيانة", "EXPENSE", "DEBIT", "5000", true],
    ["5800", "مصروفات إدارية", "EXPENSE", "DEBIT", "5000", true],
    ["5900", "مصروفات تشغيلية أخرى", "EXPENSE", "DEBIT", "5000", true],
  ] as const;

  const accIds: Record<string, string> = {};
  for (const [code, name, type, nature, parentCode, isPostable] of accounts) {
    const a = await prisma.account.create({
      data: {
        companyId: company.id,
        code,
        name,
        type,
        nature,
        parentId: parentCode ? accIds[parentCode] : null,
        level: parentCode ? (parentCode.length === 4 && !parentCode.endsWith("00") ? 3 : 2) : 1,
        isPostable,
      },
    });
    accIds[code] = a.id;
  }

  await prisma.bankAccount.create({
    data: {
      companyId: company.id,
      accountId: accIds["1120"],
      name: "البنك الأهلي — جاري",
      bankName: "الأهلي السعودي",
      iban: "SA0000000000000000000001",
      balance: 500000,
    },
  });
  await prisma.cashBox.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      accountId: accIds["1110"],
      name: "صندوق الرياض",
      balance: 25000,
    },
  });

  const expenseCats = [
    ["SALARY", "الرواتب", "5100"],
    ["RENT", "الإيجارات", "5300"],
    ["UTIL", "الكهرباء والمياه", "5400"],
    ["FUEL", "الوقود", "5500"],
    ["COMMS", "الاتصالات", "5600"],
    ["MAINT", "الصيانة", "5700"],
    ["ADMIN", "مصروفات إدارية", "5800"],
    ["OPS", "مصروفات تشغيلية", "5900"],
  ];
  for (const [code, name, acc] of expenseCats) {
    await prisma.expenseCategory.create({
      data: { companyId: company.id, code, name, accountId: accIds[acc] },
    });
  }

  // Opening balances journal
  await prisma.journalEntry.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      entryNumber: "JE-000001",
      entryDate: new Date("2026-01-01"),
      entryType: "OPENING",
      description: "قيد افتتاحي",
      status: "POSTED",
      totalDebit: 525000,
      totalCredit: 525000,
      postedAt: new Date("2026-01-01"),
      lines: {
        create: [
          { accountId: accIds["1120"], debit: 500000, credit: 0, description: "رصيد بنكي افتتاحي", lineOrder: 1 },
          { accountId: accIds["1110"], debit: 25000, credit: 0, description: "رصيد صندوق", lineOrder: 2 },
          { accountId: accIds["3100"], debit: 0, credit: 525000, description: "رأس المال", lineOrder: 3 },
        ],
      },
    },
  });

  // Sample revenue & expense
  await prisma.journalEntry.create({
    data: {
      companyId: company.id,
      entryNumber: "JE-000002",
      entryDate: new Date("2026-10-15"),
      entryType: "MANUAL",
      description: "إيراد خدمات أكتوبر",
      status: "POSTED",
      totalDebit: 180000,
      totalCredit: 180000,
      postedAt: new Date("2026-10-15"),
      lines: {
        create: [
          { accountId: accIds["1120"], debit: 180000, credit: 0, lineOrder: 1 },
          { accountId: accIds["4200"], debit: 0, credit: 180000, lineOrder: 2 },
        ],
      },
    },
  });
  await prisma.journalEntry.create({
    data: {
      companyId: company.id,
      entryNumber: "JE-000003",
      entryDate: new Date("2026-10-20"),
      entryType: "EXPENSE",
      description: "إيجار أكتوبر",
      status: "POSTED",
      totalDebit: 35000,
      totalCredit: 35000,
      postedAt: new Date("2026-10-20"),
      lines: {
        create: [
          { accountId: accIds["5300"], debit: 35000, credit: 0, costCenterId: ccAdmin.id, lineOrder: 1 },
          { accountId: accIds["1120"], debit: 0, credit: 35000, lineOrder: 2 },
        ],
      },
    },
  });
  await prisma.journalEntry.create({
    data: {
      companyId: company.id,
      entryNumber: "JE-000004",
      entryDate: new Date("2026-11-05"),
      entryType: "MANUAL",
      description: "إيراد خدمات نوفمبر",
      status: "POSTED",
      totalDebit: 210000,
      totalCredit: 210000,
      postedAt: new Date("2026-11-05"),
      lines: {
        create: [
          { accountId: accIds["1120"], debit: 210000, credit: 0, lineOrder: 1 },
          { accountId: accIds["4200"], debit: 0, credit: 210000, lineOrder: 2 },
        ],
      },
    },
  });

  const cust = await prisma.customer.create({
    data: { companyId: company.id, code: "C001", name: "مؤسسة الأفق", phone: "0112345678", balance: 0 },
  });
  const supp = await prisma.supplier.create({
    data: { companyId: company.id, code: "S001", name: "مورد التقنية", phone: "0123456789" },
  });
  const prod = await prisma.product.create({
    data: {
      companyId: company.id,
      code: "SRV-01",
      name: "خدمة استشارية",
      type: "SERVICE",
      unitPrice: 5000,
      taxRate: 15,
    },
  });

  await prisma.salesInvoice.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      customerId: cust.id,
      invoiceNumber: "INV-2026-001",
      invoiceDate: new Date("2026-11-01"),
      dueDate: new Date("2026-11-30"),
      status: "ISSUED",
      subtotal: 50000,
      taxAmount: 7500,
      total: 57500,
      paidAmount: 0,
      lines: {
        create: [
          {
            productId: prod.id,
            description: "خدمة استشارية",
            quantity: 10,
            unitPrice: 5000,
            taxRate: 15,
            lineTotal: 57500,
          },
        ],
      },
    },
  });

  // Allowances / deductions / formulas
  const allowanceDefs = [
    ["HOUSING", "بدل السكن", "PERCENT", 25, true, true],
    ["TRANSPORT", "بدل النقل", "FIXED", 1000, false, false],
    ["COMM", "بدل الاتصالات", "FIXED", 300, false, false],
    ["FOOD", "بدل الطعام", "FIXED", 500, false, false],
    ["NATURE", "بدل طبيعة العمل", "FIXED", 0, false, true],
  ] as const;
  for (const [code, name, method, value, gosi, ot] of allowanceDefs) {
    await prisma.allowanceType.create({
      data: {
        companyId: company.id,
        code,
        name,
        calcMethod: method,
        defaultValue: value,
        subjectToGosi: gosi,
        subjectToEos: true,
        includeInOt: ot,
      },
    });
  }

  await prisma.deductionType.createMany({
    data: [
      { companyId: company.id, code: "LATE", name: "خصم التأخير", category: "LATE", calcMethod: "FORMULA" },
      { companyId: company.id, code: "ABSENCE", name: "خصم الغياب", category: "ABSENCE", calcMethod: "FORMULA" },
      { companyId: company.id, code: "LOAN", name: "استقطاع سلفة", category: "LOAN", calcMethod: "FIXED" },
      { companyId: company.id, code: "PENALTY", name: "جزاءات", category: "PENALTY", calcMethod: "FIXED" },
    ],
  });

  await prisma.formulaDefinition.createMany({
    data: [
      {
        companyId: company.id,
        code: "OT_STD",
        name: "العمل الإضافي القياسي",
        category: "OVERTIME",
        expression: "round((ot_base / monthly_hours) * ot_hours * ot_factor, 2)",
        description: "قيمة الساعة × الساعات × المعامل",
        version: 1,
        effectiveFrom: new Date("2026-01-01"),
      },
      {
        companyId: company.id,
        code: "ABS_DAY",
        name: "خصم الغياب باليوم",
        category: "ABSENCE",
        expression: "round((basic_salary / month_days) * absent_days, 2)",
        version: 1,
        effectiveFrom: new Date("2026-01-01"),
      },
      {
        companyId: company.id,
        code: "LATE_HR",
        name: "خصم التأخير بالساعة مع شرط",
        category: "LATE",
        expression: "round((basic_salary / monthly_hours) * late_hours * IF(late_hours > 2, 1.1, 1), 2)",
        description: "إذا تجاوز التأخير ساعتين يُضاف 10%",
        version: 1,
        effectiveFrom: new Date("2026-01-01"),
      },
      {
        companyId: company.id,
        code: "EOS_SA",
        name: "مكافأة نهاية الخدمة — نموذج سعودي قابل للتهيئة",
        category: "EOS",
        expression:
          "IF(service_years <= 5, (fixed_value / 2) * service_years, (fixed_value / 2) * 5 + fixed_value * (service_years - 5))",
        version: 1,
        effectiveFrom: new Date("2026-01-01"),
      },
    ],
  });

  await prisma.workPolicy.create({
    data: {
      companyId: company.id,
      name: "سياسة الدوام الافتراضية",
      dailyHours: 8,
      weeklyDays: 5,
      monthlyHours: 176,
      workStart: "08:00",
      workEnd: "17:00",
      restDays: "5,6",
      otWeekdayFactor: 1.5,
      otWeekendFactor: 2,
      otHolidayFactor: 2.5,
      otBase: "BASIC_HOUSING",
      isDefault: true,
    },
  });

  await prisma.eosPolicy.create({
    data: {
      companyId: company.id,
      name: "سياسة نهاية الخدمة السعودية (قابلة للتحديث)",
      country: "SA",
      rulesJson: JSON.stringify(defaultSaudiRules()),
      isDefault: true,
    },
  });

  await prisma.saudiComplianceSettings.create({
    data: {
      companyId: company.id,
      gosiEmployeeRate: 9.75,
      gosiEmployerRate: 11.75,
      vatRate: 15,
      wpsEnabled: true,
      annualLeaveDays: 21,
    },
  });

  const leaveTypes = [
    ["ANNUAL", "إجازة سنوية", true, 21],
    ["SICK", "إجازة مرضية", true, 30],
    ["UNPAID", "بدون راتب", false, null],
    ["MARRIAGE", "إجازة زواج", true, 5],
    ["BEREAVEMENT", "إجازة وفاة", true, 5],
  ] as const;
  const leaveIds: Record<string, string> = {};
  for (const [code, name, paid, days] of leaveTypes) {
    const lt = await prisma.leaveType.create({
      data: {
        companyId: company.id,
        code,
        name,
        isPaid: paid,
        annualDays: days,
      },
    });
    leaveIds[code] = lt.id;
  }

  await prisma.incentiveType.createMany({
    data: [
      { companyId: company.id, code: "PERF", name: "مكافأة أداء", calcMethod: "FIXED", frequency: "MONTHLY" },
      { companyId: company.id, code: "SALES", name: "مكافأة مبيعات", calcMethod: "SALES_PERCENT", frequency: "MONTHLY" },
      { companyId: company.id, code: "SPECIAL", name: "مكافأة استثنائية", calcMethod: "FIXED", frequency: "ONCE" },
    ],
  });

  const housing = await prisma.allowanceType.findFirst({ where: { companyId: company.id, code: "HOUSING" } });
  const transport = await prisma.allowanceType.findFirst({ where: { companyId: company.id, code: "TRANSPORT" } });

  const emp1 = await prisma.employee.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      departmentId: deptFin.id,
      costCenterId: ccAdmin.id,
      employeeNumber: "E-001",
      fullName: "أحمد محمد الشمري",
      nationality: "سعودي",
      idNumber: "1000000001",
      phone: "0501111111",
      email: "ahmed@elite.sa",
      jobTitle: "محاسب أول",
      hireDate: new Date("2022-03-01"),
      startDate: new Date("2022-03-01"),
      contractType: "UNLIMITED",
      employmentStatus: "ACTIVE",
      basicSalary: 8000,
      dailyHours: 8,
      weeklyDays: 5,
      gosiNumber: "GOSI-001",
    },
  });
  const emp2 = await prisma.employee.create({
    data: {
      companyId: company.id,
      branchId: branchJeddah.id,
      departmentId: deptOps.id,
      costCenterId: ccOps.id,
      userId: hrUser.id,
      employeeNumber: "E-002",
      fullName: "سارة عبدالله العتيبي",
      nationality: "سعودية",
      idNumber: "1000000002",
      phone: "0502222222",
      email: "hr@elite.sa",
      jobTitle: "مديرة موارد بشرية",
      hireDate: new Date("2021-01-15"),
      startDate: new Date("2021-01-15"),
      contractType: "UNLIMITED",
      employmentStatus: "ACTIVE",
      basicSalary: 12000,
      gosiNumber: "GOSI-002",
    },
  });
  const emp3 = await prisma.employee.create({
    data: {
      companyId: company.id,
      branchId: branchRiyadh.id,
      departmentId: deptHR.id,
      employeeNumber: "E-003",
      fullName: "خالد فهد القحطاني",
      nationality: "سعودي",
      jobTitle: "أخصائي موارد بشرية",
      hireDate: new Date("2024-06-01"),
      startDate: new Date("2024-06-01"),
      contractEndDate: new Date("2026-12-31"),
      contractType: "FIXED",
      employmentStatus: "PROBATION",
      probationEnd: new Date("2024-09-01"),
      basicSalary: 6000,
    },
  });

  for (const emp of [emp1, emp2, emp3]) {
    if (housing) {
      await prisma.employeeAllowance.create({
        data: {
          employeeId: emp.id,
          allowanceTypeId: housing.id,
          calcMethod: "PERCENT",
          value: 25,
        },
      });
    }
    if (transport) {
      await prisma.employeeAllowance.create({
        data: {
          employeeId: emp.id,
          allowanceTypeId: transport.id,
          value: 1000,
        },
      });
    }
    await prisma.leaveBalance.create({
      data: {
        employeeId: emp.id,
        leaveTypeId: leaveIds.ANNUAL,
        year: 2026,
        entitled: 21,
        used: 3,
        remaining: 18,
      },
    });
    await prisma.employeeStatusHistory.create({
      data: {
        employeeId: emp.id,
        changeType: "HIRE",
        newValue: emp.employmentStatus,
        effectiveDate: emp.startDate || new Date(),
        reason: "تعيين",
      },
    });
  }

  // November 2026 attendance sample
  const year = 2026;
  const month = 11;
  for (const emp of [emp1, emp2, emp3]) {
    for (let d = 1; d <= 12; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      if (dow === 5 || dow === 6) {
        await prisma.attendanceRecord.create({
          data: {
            employeeId: emp.id,
            workDate: date,
            status: "WEEKEND",
          },
        });
        continue;
      }
      const late = emp.id === emp3.id && d === 3 ? 90 : emp.id === emp1.id && d === 5 ? 30 : 0;
      const absent = emp.id === emp3.id && d === 10;
      await prisma.attendanceRecord.create({
        data: {
          employeeId: emp.id,
          workDate: date,
          checkIn: absent ? null : late ? "09:30" : "08:00",
          checkOut: absent ? null : "17:00",
          lateMinutes: late,
          workedHours: absent ? 0 : 8 - late / 60,
          status: absent ? "ABSENT" : "PRESENT",
          source: "MANUAL",
        },
      });
    }
  }

  await prisma.overtimeRequest.create({
    data: {
      employeeId: emp1.id,
      workDate: new Date("2026-11-08"),
      startTime: "17:00",
      endTime: "20:00",
      hours: 3,
      otType: "WEEKDAY",
      reason: "إقفال شهري",
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  const loan = await prisma.loan.create({
    data: {
      employeeId: emp1.id,
      loanType: "ADVANCE",
      amount: 3000,
      installmentAmount: 500,
      installments: 6,
      remaining: 3000,
      startDeductDate: new Date("2026-11-01"),
      status: "ACTIVE",
    },
  });
  for (let i = 0; i < 6; i++) {
    await prisma.loanInstallment.create({
      data: {
        loanId: loan.id,
        dueDate: new Date(2026, 10 + i, 1),
        amount: 500,
        status: "PENDING",
      },
    });
  }

  const perf = await prisma.incentiveType.findFirst({ where: { companyId: company.id, code: "PERF" } });
  if (perf) {
    await prisma.employeeIncentive.create({
      data: {
        employeeId: emp2.id,
        incentiveTypeId: perf.id,
        amount: 2000,
        period: "2026-11",
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });
  }

  await prisma.budget.create({
    data: {
      companyId: company.id,
      name: "موازنة 2026",
      year: 2026,
      status: "APPROVED",
      lines: {
        create: [
          { costCenterId: ccAdmin.id, month: 11, amount: 50000 },
          { costCenterId: ccOps.id, month: 11, amount: 40000 },
        ],
      },
    },
  });

  console.log("✅ Seed complete");
  console.log("   Login: admin@elite.sa / Admin@123");
  console.log("   HR:    hr@elite.sa / Hr@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
