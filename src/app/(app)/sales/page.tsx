import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { SalesClient } from "@/components/sales/sales-client";

export default async function SalesPage() {
  const session = await getSession();
  if (!session) return null;

  const [invoices, customers, products] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { companyId: session.companyId },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: true,
      },
    }),
    prisma.customer.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.product.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, unitPrice: true, taxRate: true },
    }),
  ]);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="المبيعات" subtitle="فواتير المبيعات والعملاء" />
      <SalesClient
        invoices={invoices.map((i) => ({
          ...i,
          invoiceDate: i.invoiceDate.toISOString(),
        }))}
        customers={customers}
        products={products}
      />
    </div>
  );
}
