import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { postSalesInvoice } from "@/lib/sales-posting";
import { buildZatcaQrDataUrl } from "@/lib/zatca";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const invoice = await postSalesInvoice(id, session.userId);
    const qrDataUrl = invoice.zatcaQrBase64
      ? await buildZatcaQrDataUrl(invoice.zatcaQrBase64)
      : null;
    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "SalesInvoice",
      entityId: id,
      action: "POST",
      newValue: { journalId: invoice.journalId, zatcaUuid: invoice.zatcaUuid },
    });
    return NextResponse.json({ invoice, qrDataUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 400 });
  }
}
