import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const invoices = await prisma.salesInvoice.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
    include: {
      customer: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, name: true } },
      lines: {
        include: { product: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!hasPermission(session, "sales.manage")) {
    return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
  }

  const body = await req.json();
  const {
    customerId,
    branchId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    notes,
    discount,
    lines,
  } = body as {
    customerId?: string;
    branchId?: string | null;
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string | null;
    notes?: string;
    discount?: number;
    lines?: Array<{
      productId?: string | null;
      description: string;
      quantity?: number;
      unitPrice: number;
      discount?: number;
      taxRate?: number;
    }>;
  };

  if (!customerId || !invoiceDate || !lines?.length) {
    return NextResponse.json(
      { error: "الحقول المطلوبة: customerId, invoiceDate, lines" },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
  });
  if (!customer) return NextResponse.json({ error: "العميل غير موجود" }, { status: 400 });

  const computedLines = lines.map((l) => {
    const qty = Number(l.quantity ?? 1);
    const price = Number(l.unitPrice);
    const lineDiscount = Number(l.discount ?? 0);
    const taxRate = Number(l.taxRate ?? 15);
    const base = round2(qty * price - lineDiscount);
    const tax = round2(base * (taxRate / 100));
    const lineTotal = round2(base + tax);
    return {
      productId: l.productId || null,
      description: l.description,
      quantity: qty,
      unitPrice: price,
      discount: lineDiscount,
      taxRate,
      lineTotal,
      taxAmount: tax,
      base,
    };
  });

  const subtotal = round2(computedLines.reduce((s, l) => s + l.base, 0));
  const taxAmount = round2(computedLines.reduce((s, l) => s + l.taxAmount, 0));
  const invoiceDiscount = round2(Number(discount ?? 0));
  const total = round2(subtotal + taxAmount - invoiceDiscount);

  let number = invoiceNumber?.trim();
  if (!number) {
    const count = await prisma.salesInvoice.count({ where: { companyId: session.companyId } });
    number = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
  }

  try {
    const invoice = await prisma.salesInvoice.create({
      data: {
        companyId: session.companyId,
        customerId,
        branchId: branchId || null,
        invoiceNumber: number,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: "DRAFT",
        subtotal,
        discount: invoiceDiscount,
        taxAmount,
        total,
        notes: notes || null,
        lines: {
          create: computedLines.map((row) => ({
            productId: row.productId,
            description: row.description,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            discount: row.discount,
            taxRate: row.taxRate,
            lineTotal: row.lineTotal,
          })),
        },
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: true,
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "SalesInvoice",
      entityId: invoice.id,
      action: "CREATE",
      newValue: { invoiceNumber: invoice.invoiceNumber, total: invoice.total },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل إنشاء الفاتورة";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "رقم الفاتورة مستخدم مسبقاً" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
