import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";
import { postSalesInvoice } from "@/lib/sales-posting";

/** Create POS sale invoice and post immediately (AR/Sales/VAT + COGS/stock) */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const lines = (body.lines || []) as Array<{
    productId: string;
    quantity: number;
    unitPrice?: number;
  }>;
  if (!lines.length) return NextResponse.json({ error: "السلة فارغة" }, { status: 400 });

  let customer = await prisma.customer.findFirst({
    where: { companyId: session.companyId, code: "CASH" },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId: session.companyId,
        code: "CASH",
        name: "عميل نقدي — نقطة البيع",
      },
    });
  }

  const products = await prisma.product.findMany({
    where: {
      companyId: session.companyId,
      id: { in: lines.map((l) => l.productId) },
    },
  });
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  const computed = lines.map((l) => {
    const p = byId[l.productId];
    if (!p) throw new Error("صنف غير موجود");
    const qty = Number(l.quantity);
    const unitPrice = Number(l.unitPrice ?? p.unitPrice);
    const taxRate = p.taxRate ?? 15;
    const base = round2(qty * unitPrice);
    const tax = round2(base * (taxRate / 100));
    return {
      productId: p.id,
      description: p.name,
      quantity: qty,
      unitPrice,
      discount: 0,
      taxRate,
      lineTotal: round2(base + tax),
      taxAmount: tax,
      base,
    };
  });

  const subtotal = round2(computed.reduce((s, l) => s + l.base, 0));
  const taxAmount = round2(computed.reduce((s, l) => s + l.taxAmount, 0));
  const total = round2(subtotal + taxAmount);
  const count = await prisma.salesInvoice.count({ where: { companyId: session.companyId } });
  const invoiceNumber = `POS-${Date.now().toString().slice(-8)}-${count + 1}`;

  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId: session.companyId,
      customerId: customer.id,
      invoiceNumber,
      invoiceDate: new Date(),
      status: "DRAFT",
      subtotal,
      taxAmount,
      total,
      paidAmount: body.paid !== false ? total : 0,
      source: "POS",
      notes: body.notes || "بيع نقطة البيع",
      lines: {
        create: computed.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: 0,
          taxRate: l.taxRate,
          lineTotal: l.lineTotal,
        })),
      },
    },
  });

  const posted = await postSalesInvoice(invoice.id, session.userId);
  await writeAudit({
    companyId: session.companyId,
    userId: session.userId,
    entityType: "SalesInvoice",
    entityId: posted.id,
    action: "POST",
    newValue: { source: "POS", total: posted.total },
  });

  return NextResponse.json(posted, { status: 201 });
}
