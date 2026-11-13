import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { incomeStatement } from "@/lib/accounting";
import { formatMoney, round2 } from "@/lib/utils";

/**
 * Read-only AI Financial Assistant — answers from live system data.
 * No mutations / no posting.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { question } = await req.json();
  const q = String(question || "").trim();
  if (!q) return NextResponse.json({ error: "السؤال مطلوب" }, { status: 400 });

  const now = new Date();
  const year = 2026;
  const month = 11;
  const dash = await getDashboardData(session.companyId, year, month);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  const source = {
    period: `نوفمبر ${year}`,
    companyId: session.companyId,
    computedAt: now.toISOString(),
  };

  let answer = "";
  let method = "";

  if (/ربح|أرباح|صافي/.test(q)) {
    answer = `صافي الأرباح للفترة ${source.period} هو ${formatMoney(dash.financial.netIncome)}. الإيرادات ${formatMoney(dash.financial.revenue)} والمصروفات ${formatMoney(dash.financial.expenses)}.`;
    method = "قائمة الدخل من القيود المرحلة (إيرادات − مصروفات)";
  } else if (/فرع.*(إنفاق|مصروف)|أكثر.*فرع/.test(q)) {
    const top = [...dash.charts.branchPerf].sort((a, b) => b.salaryBase - a.salaryBase)[0];
    answer = top
      ? `أعلى فرع من حيث تكلفة الرواتب الأساسية: ${top.name} بمبلغ ${formatMoney(top.salaryBase)} لـ ${top.employees} موظفين.`
      : "لا توجد بيانات فروع.";
    method = "تجميع basicSalary للموظفين النشطين حسب الفرع";
  } else if (/أكبر.*(مصروف|بنود)|بنود مصروف/.test(q)) {
    const top5 = [...dash.charts.expenseByAccount].sort((a, b) => b.value - a.value).slice(0, 5);
    answer =
      top5.length === 0
        ? "لا توجد مصروفات مرحلة في الفترة."
        : `أكبر بنود المصروفات في ${source.period}:\n` +
          top5.map((e, i) => `${i + 1}. ${e.name}: ${formatMoney(e.value)}`).join("\n");
    method = "ميزان مراجعة لحسابات نوع EXPENSE خلال الفترة";
  } else if (/روات.*إيراد|نسبة الرواتب/.test(q)) {
    answer =
      dash.kpis.payrollToRevenue != null
        ? `نسبة الرواتب إلى الإيرادات ≈ ${dash.kpis.payrollToRevenue}% (إجمالي مسير ${formatMoney(dash.financial.payrollGross)} ÷ إيرادات ${formatMoney(dash.financial.revenue)}).`
        : "لا يوجد مسير رواتب محتسب بعد لمقارنة النسبة.";
    method = "payroll.totalGross / income.totalRevenue";
  } else if (/أعلى تكلفة|تكلفة موظف|الموظفون الأعلى/.test(q)) {
    const emps = await prisma.employee.findMany({
      where: { companyId: session.companyId, employmentStatus: { in: ["ACTIVE", "PROBATION"] } },
      include: { allowances: true },
      orderBy: { basicSalary: "desc" },
      take: 5,
    });
    answer =
      "أعلى الموظفين تكلفة (أساسي + بدلات تقديرية):\n" +
      emps
        .map((e, i) => {
          const all = e.allowances.reduce((s, a) => s + a.value, 0);
          return `${i + 1}. ${e.fullName}: أساسي ${formatMoney(e.basicSalary)} + بدلات مسجّلة ${formatMoney(all)}`;
        })
        .join("\n");
    method = "ترتيب الموظفين حسب basicSalary مع مجموع بدلاتهم النشطة";
  } else if (/غير طبيع|شاذ|تنبيه/.test(q)) {
    answer =
      dash.alerts.length > 0
        ? "التنبيهات الحالية:\n" + dash.alerts.map((a) => `• ${a.message}`).join("\n")
        : "لا توجد تنبيهات غير طبيعية حسب القواعد الحالية.";
    method = "قواعد التنبيه في لوحة التحكم (مصروفات/إيرادات/سيولة/عقود)";
  } else if (/توقع|توقّع|أشهر|تنبؤ/.test(q)) {
    const avg =
      dash.charts.monthly.reduce((s, m) => s + m.profit, 0) / Math.max(dash.charts.monthly.length, 1);
    answer = `بناءً على متوسط صافي الربح لآخر ${dash.charts.monthly.length} أشهر (${formatMoney(avg)})، التوقع البسيط للأشهر الثلاثة القادمة ≈ ${formatMoney(avg * 3)} إجماليًا (نموذج متوسط متحركة بسيط — ليس ضماناً مالياً).`;
    method = "متوسط صافي الربح الشهري التاريخي × 3";
  } else if (/تدفق نقد|سيولة|توسع/.test(q)) {
    const liquidity = dash.financial.cash + dash.financial.bank;
    const ok = liquidity > dash.financial.expenses;
    answer = `الرصيد النقدي والبنكي الحالي ≈ ${formatMoney(liquidity)}. مصروفات الفترة ${formatMoney(dash.financial.expenses)}. ${ok ? "السيولة تغطي مصروفات الفترة الحالية، ما يدعم حذراً قرار توسع محدود." : "السيولة أقل من مصروفات الفترة — يُفضّل تأجيل التوسع ومراجعة التحصيل."}`;
    method = "أرصدة حسابي الصندوق والبنك من القيود المرحلة مقارنة بمصروفات الفترة";
  } else if (/موظف/.test(q)) {
    answer = `الموظفون الحاليون: ${dash.hr.active} (منهم ${dash.hr.probation} في التجربة). العقود القاربة على الانتهاء: ${dash.hr.contractsExpiring}.`;
    method = "عدادات employmentStatus وعقود contractEndDate";
  } else {
    const inc = await incomeStatement(session.companyId, from, to);
    answer = `ملخص ${source.period}: إيرادات ${formatMoney(inc.totalRevenue)} · مصروفات ${formatMoney(inc.totalExpense)} · صافي ${formatMoney(inc.netIncome)} · نقدية+بنوك ${formatMoney(dash.financial.cash + dash.financial.bank)} · موظفون ${dash.hr.active}. يمكنك السؤال عن الأرباح، المصروفات، الفروع، نسبة الرواتب، أو التوقعات.`;
    method = "ملخص لوحة التحكم + قائمة الدخل";
  }

  return NextResponse.json({
    question: q,
    answer,
    method,
    source,
    readOnly: true,
    note: "المساعد للقراءة فقط ولا يعدّل البيانات أو يرحّل القيود.",
    confidence: round2(0.85),
  });
}
