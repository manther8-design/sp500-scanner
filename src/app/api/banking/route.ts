import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const [bankAccounts, cashBoxes, vouchers] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
      include: {
        account: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.cashBox.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
      include: {
        account: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.voucher.findMany({
      where: { companyId: session.companyId },
      orderBy: [{ voucherDate: "desc" }, { voucherNumber: "desc" }],
      include: {
        bankAccount: { select: { id: true, name: true } },
        cashBox: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({ bankAccounts, cashBoxes, vouchers });
}
