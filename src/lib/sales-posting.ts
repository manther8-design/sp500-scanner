import { prisma } from "./prisma";
import { createJournalEntry } from "./accounting";
import { buildZatcaTlvBase64 } from "./zatca";
import { issueStock } from "./inventory";
import { round2 } from "./utils";
import { randomUUID } from "crypto";

/**
 * Issue sales invoice: AR Dr / Sales Cr / VAT Cr + optional COGS + inventory OUT + ZATCA QR
 */
export async function postSalesInvoice(invoiceId: string, userId?: string) {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      company: true,
      customer: true,
      lines: { include: { product: true } },
    },
  });
  if (!invoice) throw new Error("الفاتورة غير موجودة");
  if (invoice.journalId) throw new Error("تم ترحيل الفاتورة مسبقاً");
  if (!["DRAFT", "ISSUED"].includes(invoice.status)) {
    throw new Error("لا يمكن ترحيل هذه الحالة");
  }

  const ar = await prisma.account.findFirst({
    where: { companyId: invoice.companyId, code: "1130" },
  });
  const sales = await prisma.account.findFirst({
    where: { companyId: invoice.companyId, code: { in: ["4100", "4200"] } },
  });
  const vat = await prisma.account.findFirst({
    where: { companyId: invoice.companyId, code: "2140" },
  });
  if (!ar || !sales || !vat) {
    throw new Error("حسابات المبيعات/الذمم/الضريبة غير مكتملة في دليل الحسابات");
  }

  const netSales = round2(invoice.subtotal - invoice.discount);
  const journal = await createJournalEntry({
    companyId: invoice.companyId,
    branchId: invoice.branchId,
    entryDate: invoice.invoiceDate,
    entryType: "SALES",
    description: `فاتورة مبيعات ${invoice.invoiceNumber} — ${invoice.customer.name}`,
    reference: invoice.invoiceNumber,
    sourceType: "SALES_INVOICE",
    sourceId: invoice.id,
    createdById: userId,
    status: "POSTED",
    lines: [
      { accountId: ar.id, debit: invoice.total, credit: 0, description: "ذمم مدينة" },
      { accountId: sales.id, debit: 0, credit: netSales, description: "إيراد مبيعات" },
      ...(invoice.taxAmount > 0
        ? [{ accountId: vat.id, debit: 0, credit: invoice.taxAmount, description: "ضريبة قيمة مضافة" }]
        : []),
    ],
  });

  // Inventory OUT + COGS
  let totalCogs = 0;
  for (const line of invoice.lines) {
    if (!line.productId || !line.product) continue;
    if (!line.product.trackInventory && line.product.type !== "PRODUCT") continue;
    const result = await issueStock({
      companyId: invoice.companyId,
      productId: line.productId,
      quantity: line.quantity,
      referenceType: invoice.source === "POS" ? "POS" : "SALES_INVOICE",
      referenceId: invoice.id,
      notes: invoice.invoiceNumber,
    });
    if (!result.skipped) totalCogs = round2(totalCogs + result.cogs);
  }

  let cogsJournalId: string | null = null;
  if (totalCogs > 0) {
    const cogsAcc = await prisma.account.findFirst({
      where: { companyId: invoice.companyId, code: "5900" },
    });
    const inventoryAcc = await prisma.account.findFirst({
      where: { companyId: invoice.companyId, code: "1140" },
    });
    if (cogsAcc && inventoryAcc) {
      const cogsJe = await createJournalEntry({
        companyId: invoice.companyId,
        branchId: invoice.branchId,
        entryDate: invoice.invoiceDate,
        entryType: "AUTO",
        description: `تكلفة بضاعة مباعة — ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        sourceType: "SALES_COGS",
        sourceId: invoice.id,
        createdById: userId,
        status: "POSTED",
        lines: [
          { accountId: cogsAcc.id, debit: totalCogs, credit: 0 },
          { accountId: inventoryAcc.id, debit: 0, credit: totalCogs },
        ],
      });
      cogsJournalId = cogsJe.id;
    }
  }

  const zatcaUuid = randomUUID();
  const zatcaQrBase64 = buildZatcaTlvBase64({
    sellerName: invoice.company.name,
    vatNumber: invoice.company.taxNumber || "",
    timestamp: invoice.invoiceDate,
    totalWithVat: invoice.total,
    vatAmount: invoice.taxAmount,
  });

  await prisma.customer.update({
    where: { id: invoice.customerId },
    data: { balance: { increment: round2(invoice.total - invoice.paidAmount) } },
  });

  return prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: {
      status: invoice.paidAmount >= invoice.total ? "PAID" : "ISSUED",
      journalId: journal.id,
      cogsJournalId,
      zatcaUuid,
      zatcaQrBase64,
    },
    include: { customer: true, lines: true },
  });
}
