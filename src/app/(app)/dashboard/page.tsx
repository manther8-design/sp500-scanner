import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import { Kpi, PageHeader, Alert } from "@/components/ui";
import { DashboardCharts } from "@/components/dashboard-charts";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const data = await getDashboardData(session.companyId, 2026, 11);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="لوحة التحكم"
        subtitle={`مرحباً ${session.fullName} — نوفمبر 2026 · شركة النخبة للخدمات`}
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
        <Kpi label="إجمالي الإيرادات" value={formatMoney(data.financial.revenue)} tone="green" />
        <Kpi label="إجمالي المصروفات" value={formatMoney(data.financial.expenses)} tone="orange" />
        <Kpi label="صافي الربح/الخسارة" value={formatMoney(data.financial.netIncome)} tone="blue" />
        <Kpi label="الأرصدة النقدية + البنوك" value={formatMoney(data.financial.cash + data.financial.bank)} tone="navy" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="الأصول" value={formatMoney(data.financial.assets)} />
        <Kpi label="الالتزامات" value={formatMoney(data.financial.liabilities)} tone="orange" />
        <Kpi label="حقوق الملكية" value={formatMoney(data.financial.equity)} tone="green" />
        <Kpi
          label="هامش صافي الربح"
          value={`${data.kpis.netProfitMargin}%`}
          hint={data.kpis.payrollToRevenue != null ? `الرواتب/الإيرادات: ${data.kpis.payrollToRevenue}%` : undefined}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="الموظفون الحاليون" value={String(data.hr.active)} tone="blue" />
        <Kpi label="في فترة التجربة" value={String(data.hr.probation)} tone="orange" />
        <Kpi label="إجازات حالية" value={String(data.hr.onLeave)} />
        <Kpi label="عقود قاربت الانتهاء" value={String(data.hr.contractsExpiring)} tone="red" />
      </div>

      <DashboardCharts monthly={data.charts.monthly} expenses={data.charts.expenseByAccount} branches={data.charts.branchPerf} />
    </div>
  );
}
