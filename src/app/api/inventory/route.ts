import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { receiveStock } from "@/lib/inventory";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const [products, warehouses, movements] = await Promise.all([
    prisma.product.findMany({
      where: { companyId: session.companyId },
      orderBy: { code: "asc" },
    }),
    prisma.warehouse.findMany({ where: { companyId: session.companyId } }),
    prisma.stockMovement.findMany({
      where: { companyId: session.companyId },
      include: { product: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return NextResponse.json({ products, warehouses, movements });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();

  try {
    if (body.action === "create_product") {
      const product = await prisma.product.create({
        data: {
          companyId: session.companyId,
          code: body.code,
          name: body.name,
          type: body.type || "PRODUCT",
          unitPrice: Number(body.unitPrice || 0),
          costPrice: Number(body.costPrice || 0),
          stockQty: Number(body.stockQty || 0),
          reorderLevel: Number(body.reorderLevel || 0),
          taxRate: Number(body.taxRate ?? 15),
          trackInventory: body.trackInventory !== false,
        },
      });
      return NextResponse.json(product, { status: 201 });
    }

    if (body.action === "receive") {
      const result = await receiveStock({
        companyId: session.companyId,
        productId: body.productId,
        quantity: Number(body.quantity),
        unitCost: Number(body.unitCost),
        warehouseId: body.warehouseId,
        notes: body.notes,
        referenceType: "MANUAL_RECEIVE",
      });
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "StockMovement",
        entityId: result.movement.id,
        action: "CREATE",
        newValue: result,
      });
      return NextResponse.json(result);
    }

    if (body.action === "ensure_warehouse") {
      const existing = await prisma.warehouse.findFirst({
        where: { companyId: session.companyId },
      });
      if (existing) return NextResponse.json(existing);
      const wh = await prisma.warehouse.create({
        data: {
          companyId: session.companyId,
          code: "MAIN",
          name: "المستودع الرئيسي",
          isDefault: true,
        },
      });
      return NextResponse.json(wh, { status: 201 });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 400 });
  }
}
