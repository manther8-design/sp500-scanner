import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postJournal, reverseJournal } from "@/lib/accounting";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await ctx.params;
  const entry = await prisma.journalEntry.findFirst({
    where: { id, companyId: session.companyId },
    include: { lines: { include: { account: true }, orderBy: { lineOrder: "asc" } } },
  });
  if (!entry) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.journalEntry.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const body = await req.json();
  try {
    if (body.action === "approve") {
      const entry = await prisma.journalEntry.update({
        where: { id },
        data: { status: "APPROVED", approvedAt: new Date(), approvedById: session.userId },
      });
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "JournalEntry",
        entityId: id,
        action: "APPROVE",
      });
      return NextResponse.json(entry);
    }
    if (body.action === "post") {
      const entry = await postJournal(id, session.userId);
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "JournalEntry",
        entityId: id,
        action: "POST",
      });
      return NextResponse.json(entry);
    }
    if (body.action === "reverse") {
      const entry = await reverseJournal(id, session.userId);
      await writeAudit({
        companyId: session.companyId,
        userId: session.userId,
        entityType: "JournalEntry",
        entityId: id,
        action: "REVERSE",
        newValue: { reversalId: entry.id },
      });
      return NextResponse.json(entry);
    }
    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 400 });
  }
}
