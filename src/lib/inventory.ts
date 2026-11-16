import { prisma } from "./prisma";
import { round2 } from "./utils";

/** Weighted Average Cost on stock IN */
export async function receiveStock(params: {
  companyId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  warehouseId?: string | null;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}) {
  if (params.quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");
  const product = await prisma.product.findFirst({
    where: { id: params.productId, companyId: params.companyId },
  });
  if (!product) throw new Error("الصنف غير موجود");

  const qtyIn = params.quantity;
  const costIn = params.unitCost;
  const oldQty = product.stockQty || 0;
  const oldCost = product.costPrice || 0;
  const newQty = round2(oldQty + qtyIn);
  const newAvg =
    newQty === 0 ? 0 : round2((oldQty * oldCost + qtyIn * costIn) / newQty);

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        companyId: params.companyId,
        productId: params.productId,
        warehouseId: params.warehouseId || null,
        movementType: "IN",
        quantity: qtyIn,
        unitCost: costIn,
        totalCost: round2(qtyIn * costIn),
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
      },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: {
        stockQty: newQty,
        costPrice: newAvg,
        trackInventory: true,
        type: product.type === "SERVICE" ? "PRODUCT" : product.type,
      },
    }),
  ]);

  return { movement, newQty, newAvg };
}

/** Issue stock OUT using current WAC — returns COGS amount */
export async function issueStock(params: {
  companyId: string;
  productId: string;
  quantity: number;
  warehouseId?: string | null;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  allowNegative?: boolean;
}) {
  if (params.quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");
  const product = await prisma.product.findFirst({
    where: { id: params.productId, companyId: params.companyId },
  });
  if (!product) throw new Error("الصنف غير موجود");
  if (!product.trackInventory && product.type === "SERVICE") {
    return { cogs: 0, unitCost: 0, skipped: true as const };
  }
  if (!params.allowNegative && product.stockQty < params.quantity) {
    throw new Error(`المخزون غير كافٍ للصنف ${product.name}`);
  }

  const unitCost = product.costPrice || 0;
  const cogs = round2(params.quantity * unitCost);
  const newQty = round2(product.stockQty - params.quantity);

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        companyId: params.companyId,
        productId: params.productId,
        warehouseId: params.warehouseId || null,
        movementType: params.referenceType === "POS" ? "POS" : "OUT",
        quantity: params.quantity,
        unitCost,
        totalCost: cogs,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
      },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { stockQty: newQty },
    }),
  ]);

  return { cogs, unitCost, skipped: false as const, newQty };
}
