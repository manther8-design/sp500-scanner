import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJournalEntry } from "@/lib/accounting";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const journals = await prisma.journalEntry.findMany({
    where: { companyId: session.companyId },
    include: { lines: { include: { account: true }, orderBy: { lineOrder: "asc" } }, branch: true },
    orderBy: [{ entryDate: "desc" }, { entryNumber: "desc" }],
  });
  return NextResponse.json(journals);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  try {
    const entry = await createJournalEntry({
      companyId: session.companyId,
      branchId: body.branchId,
      entryDate: new Date(body.entryDate || Date.now()),
      entryType: body.entryType || "MANUAL",
      description: body.description,
      reference: body.reference,
      createdById: session.userId,
      status: body.status || "DRAFT",
      lines: body.lines || [],
    });
    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "JournalEntry",
      entityId: entry.id,
      action: "CREATE",
      newValue: { entryNumber: entry.entryNumber, totalDebit: entry.totalDebit },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 400 });
  }
}
