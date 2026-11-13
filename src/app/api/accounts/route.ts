import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const accounts = await prisma.account.findMany({
    where: { companyId: session.companyId },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const parent = body.parentId
    ? await prisma.account.findFirst({ where: { id: body.parentId, companyId: session.companyId } })
    : null;
  const acc = await prisma.account.create({
    data: {
      companyId: session.companyId,
      code: body.code,
      name: body.name,
      nameEn: body.nameEn,
      type: body.type,
      nature: body.nature,
      parentId: parent?.id || null,
      level: parent ? parent.level + 1 : 1,
      isPostable: body.isPostable !== false,
      branchId: body.branchId || null,
    },
  });
  await writeAudit({
    companyId: session.companyId,
    userId: session.userId,
    entityType: "Account",
    entityId: acc.id,
    action: "CREATE",
    newValue: acc,
  });
  return NextResponse.json(acc, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرف مطلوب" }, { status: 400 });
  const account = await prisma.account.findFirst({ where: { id, companyId: session.companyId } });
  if (!account) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
  const used = await prisma.journalLine.count({ where: { accountId: id } });
  if (used > 0) {
    return NextResponse.json({ error: "لا يمكن حذف حساب مستخدم في قيود سابقة" }, { status: 400 });
  }
  await prisma.account.delete({ where: { id } });
  await writeAudit({
    companyId: session.companyId,
    userId: session.userId,
    entityType: "Account",
    entityId: id,
    action: "DELETE",
  });
  return NextResponse.json({ ok: true });
}
