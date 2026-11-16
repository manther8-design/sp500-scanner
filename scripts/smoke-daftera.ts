import { prisma } from "../src/lib/prisma";
import { postSalesInvoice } from "../src/lib/sales-posting";
import { calculatePayrollRun } from "../src/lib/payroll";
import { receiveStock } from "../src/lib/inventory";

async function main() {
  const inv = await prisma.salesInvoice.findFirst({ where: { journalId: null } });
  if (inv) {
    const posted = await postSalesInvoice(inv.id, "test");
    console.log("SALES_POSTED", posted.invoiceNumber, "qr", !!posted.zatcaQrBase64, "je", posted.journalId);
  }

  const product = await prisma.product.findFirst({ where: { code: "PRD-01" } });
  const company = await prisma.company.findFirst();
  if (product && company) {
    const r = await receiveStock({
      companyId: company.id,
      productId: product.id,
      quantity: 10,
      unitCost: 850,
    });
    console.log("WAC", r.newAvg, "qty", r.newQty);
  }

  if (company) {
    const run = await calculatePayrollRun({ companyId: company.id, year: 2026, month: 12 });
    for (const i of run.items) {
      const b = JSON.parse(i.breakdownJson || "{}");
      console.log("PAY", i.employee.fullName, "basic", i.basicSalary, "factor", b.proration?.factor);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
