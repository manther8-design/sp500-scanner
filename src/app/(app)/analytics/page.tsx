import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import { PageHeader, Kpi, Alert } from "@/components/ui";
import { DashboardCharts } from "@/components/dashboard-charts";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const data = await getDashboardData(session.companyId, year, month);
  const period = `${year}/${String(month).padStart(2, "0")}`;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="التحليل المالي"
        subtitle={`مؤشرات الأداء والرسوم البيانية — فترة ${period}`}
      />

      {data.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.alerts.map((a, i) => (
            <Alert key={i} type={a.type === "danger" ? "error" : a.type === "warning" ? "warning" : "info"}>
              {a.message}
            </Alert>
          ))}
        </div>
      )}

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="الإيرادات" value={formatMoney(data.financial.revenue)} tone="green" />
        <Kpi label="المصروفات" value={formatMoney(data.financial.expenses)} tone="orange" />
        <Kpi label="صافي الدخل" value={formatMoney(data.financial.netIncome)} tone="blue" />
        <Kpi
          label="هامش الربح"
          value={`${data.kpis.netProfitMargin}%`}
          hint={
            data.prevNetIncome != null
              ? `صافي الشهر السابق: ${formatMoney(data.prevNetIncome)}`
              : undefined
          }
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="الأصول" value={formatMoney(data.financial.assets)} />
        <Kpi label="الالتزامات" value={formatMoney(data.financial.liabilities)} tone="orange" />
        <Kpi label="حقوق الملكية" value={formatMoney(data.financial.equity)} tone="green" />
        <Kpi
          label="نسبة التداول التقريبية"
          value={data.kpis.currentRatio != null ? String(data.kpis.currentRatio) : "—"}
          tone="navy"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="نقد + بنوك" value={formatMoney(data.financial.cash + data.financial.bank)} tone="blue" />
        <Kpi label="ذمم مدينة" value={formatMoney(data.financial.receivables)} />
        <Kpi label="ذمم دائنة" value={formatMoney(data.financial.payables)} tone="orange" />
        <Kpi
          label="رواتب / إيرادات"
          value={data.kpis.payrollToRevenue != null ? `${data.kpis.payrollToRevenue}%` : "—"}
          hint={`آخر إجمالي رواتب: ${formatMoney(data.financial.payrollGross)}`}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="موظفون نشطون" value={String(data.hr.active)} tone="blue" />
        <Kpi label="تجربة" value={String(data.hr.probation)} tone="orange" />
        <Kpi label="إجازات حالية" value={String(data.hr.onLeave)} />
        <Kpi label="عقود قاربت الانتهاء" value={String(data.hr.contractsExpiring)} tone="red" />
      </div>

      <DashboardCharts
        monthly={data.charts.monthly}
        expenses={data.charts.expenseByAccount}
        branches={data.charts.branchPerf}
      />
    </div>
  );
}
