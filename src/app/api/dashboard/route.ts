import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
  const data = await getDashboardData(session.companyId, year, month);
  return NextResponse.json(data);
}
