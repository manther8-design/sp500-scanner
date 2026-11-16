import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 1) return NextResponse.json([]);

  const companyId = session.companyId;
  const [customers, invoices, employees, products] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      take: 5,
    }),
    prisma.salesInvoice.findMany({
      where: { companyId, invoiceNumber: { contains: q } },
      take: 5,
    }),
    prisma.employee.findMany({
      where: {
        companyId,
        OR: [{ fullName: { contains: q } }, { employeeNumber: { contains: q } }],
      },
      take: 5,
    }),
    prisma.product.findMany({
      where: { companyId, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      take: 5,
    }),
  ]);

  return NextResponse.json([
    ...customers.map((c) => ({ type: "عميل", id: c.id, label: `${c.code} — ${c.name}`, href: "/sales" })),
    ...invoices.map((i) => ({
      type: "فاتورة",
      id: i.id,
      label: i.invoiceNumber,
      href: "/sales",
    })),
    ...employees.map((e) => ({
      type: "موظف",
      id: e.id,
      label: `${e.employeeNumber} — ${e.fullName}`,
      href: "/hr/employees",
    })),
    ...products.map((p) => ({
      type: "صنف",
      id: p.id,
      label: `${p.code} — ${p.name}`,
      href: "/inventory",
    })),
  ]);
}
