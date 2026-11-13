import { calculatePayrollRun, approvePayrollRun, postPayrollToAccounting } from "../src/lib/payroll";
import { prisma } from "../src/lib/prisma";

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("no company");
  const run = await calculatePayrollRun({ companyId: company.id, year: 2026, month: 11 });
  console.log("CALCULATED", run.runNumber, "gross", run.totalGross, "net", run.totalNet, "items", run.items.length);
  for (const it of run.items) {
    console.log("-", it.employee.fullName, "net", it.netSalary, "ot", it.totalOvertime, "ded", it.totalDeductions);
  }
  await approvePayrollRun(run.id, "seed-admin");
  const posted = await postPayrollToAccounting(run.id, "seed-admin");
  console.log("POSTED", posted.status, "journal", posted.journalId);
  const je = await prisma.journalEntry.findUnique({
    where: { id: posted.journalId! },
    include: { lines: true },
  });
  console.log(
    "JOURNAL",
    je?.entryNumber,
    je?.totalDebit,
    je?.totalCredit,
    "balanced",
    je?.totalDebit === je?.totalCredit,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
