import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAudit } from "@/lib/auth";
import {
  ALLOWED_VARS,
  testFormula,
  validateFormula,
  type FormulaContext,
} from "@/lib/formula-engine";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("active") !== "false";

  const formulas = await prisma.formulaDefinition.findMany({
    where: {
      companyId: session.companyId,
      ...(category ? { category } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ category: "asc" }, { code: "asc" }, { version: "desc" }],
  });

  return NextResponse.json({ formulas, allowedVars: ALLOWED_VARS });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json();

    // Test mode: { expression, context }
    if (body.expression != null && body.context != null && !body.code) {
      const validation = validateFormula(String(body.expression));
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error, ok: false }, { status: 400 });
      }
      const ctx = body.context as FormulaContext;
      const result = testFormula(String(body.expression), ctx);
      return NextResponse.json({ ok: true, ...result, expression: body.expression, context: ctx });
    }

    const {
      code,
      name,
      category,
      expression,
      description,
      variables,
      effectiveFrom,
      branchId,
      contractType,
      employeeClass,
    } = body;

    if (!code || !name || !category || !expression) {
      return NextResponse.json({ error: "بيانات المعادلة غير مكتملة" }, { status: 400 });
    }

    const validation = validateFormula(String(expression));
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const latest = await prisma.formulaDefinition.findFirst({
      where: { companyId: session.companyId, code: String(code) },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version || 0) + 1;
    const from = effectiveFrom ? new Date(effectiveFrom) : new Date();

    if (latest && latest.isActive) {
      await prisma.formulaDefinition.update({
        where: { id: latest.id },
        data: {
          effectiveTo: new Date(from.getTime() - 1000),
          isActive: false,
        },
      });
    }

    const formula = await prisma.formulaDefinition.create({
      data: {
        companyId: session.companyId,
        code: String(code),
        name: String(name),
        category: String(category),
        expression: String(expression),
        description: description || null,
        variables: variables
          ? typeof variables === "string"
            ? variables
            : JSON.stringify(variables)
          : JSON.stringify(ALLOWED_VARS),
        version,
        effectiveFrom: from,
        isActive: true,
        branchId: branchId || null,
        contractType: contractType || null,
        employeeClass: employeeClass || null,
        createdById: session.userId,
        testResult: null,
      },
    });

    await writeAudit({
      companyId: session.companyId,
      userId: session.userId,
      entityType: "FormulaDefinition",
      entityId: formula.id,
      action: "CREATE",
      newValue: { code: formula.code, version: formula.version, expression: formula.expression },
    });

    return NextResponse.json(formula, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
