import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { PurchasesClient } from "@/components/purchases/purchases-client";

export default async function PurchasesPage() {
  const session = await getSession();
  if (!session) return null;

  const [invoices, suppliers] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: { companyId: session.companyId },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: true,
      },
    }),
    prisma.supplier.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="المشتريات" subtitle="فواتير المشتريات والموردين" />
      <PurchasesClient
        invoices={invoices.map((i) => ({
          ...i,
          invoiceDate: i.invoiceDate.toISOString(),
        }))}
        suppliers={suppliers}
      />
    </div>
  );
}
