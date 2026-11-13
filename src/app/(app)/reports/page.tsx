import { getSession } from "@/lib/auth";
import { balanceSheet, incomeStatement, trialBalance } from "@/lib/accounting";
import { formatMoney } from "@/lib/utils";
import { PageHeader, Kpi, EmptyState } from "@/components/ui";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const [income, sheet, trial] = await Promise.all([
    incomeStatement(session.companyId, from, to),
    balanceSheet(session.companyId, to),
    trialBalance(session.companyId, from, to),
  ]);

  const period = `${year}/${String(month).padStart(2, "0")}`;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="التقارير المالية"
        subtitle={`قائمة الدخل · الميزانية · ميزان المراجعة — ${period}`}
        actions={
          <form className="flex gap-2">
            <select name="month" defaultValue={month} className="input w-auto">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  شهر {i + 1}
                </option>
              ))}
            </select>
            <input name="year" type="number" defaultValue={year} className="input w-24" />
            <button type="submit" className="btn-secondary">
              تحديث
            </button>
          </form>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Kpi label="إجمالي الإيرادات" value={formatMoney(income.totalRevenue)} tone="green" />
        <Kpi label="إجمالي المصروفات" value={formatMoney(income.totalExpense)} tone="orange" />
        <Kpi label="صافي الدخل" value={formatMoney(income.netIncome)} tone="blue" />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-navy">قائمة الدخل</h2>
        {income.revenue.length + income.expense.length === 0 ? (
          <EmptyState title="لا حركات إيراد/مصروف لهذه الفترة" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>إيرادات</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {income.revenue.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.code} — {r.name}
                      </td>
                      <td>{formatMoney(r.credit - r.debit)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-semibold">الإجمالي</td>
                    <td className="font-semibold">{formatMoney(income.totalRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>مصروفات</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {income.expense.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.code} — {r.name}
                      </td>
                      <td>{formatMoney(r.debit - r.credit)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-semibold">الإجمالي</td>
                    <td className="font-semibold">{formatMoney(income.totalExpense)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-navy">الميزانية العمومية</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Kpi label="الأصول" value={formatMoney(sheet.totalAssets)} />
          <Kpi label="الالتزامات" value={formatMoney(sheet.totalLiabilities)} tone="orange" />
          <Kpi label="حقوق الملكية" value={formatMoney(sheet.totalEquity)} tone="green" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { title: "الأصول", rows: sheet.assets, bal: (r: (typeof sheet.assets)[0]) => r.debit - r.credit },
            {
              title: "الالتزامات",
              rows: sheet.liabilities,
              bal: (r: (typeof sheet.liabilities)[0]) => r.credit - r.debit,
            },
            { title: "حقوق الملكية", rows: sheet.equity, bal: (r: (typeof sheet.equity)[0]) => r.credit - r.debit },
          ].map((col) => (
            <div key={col.title} className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{col.title}</th>
                    <th>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {col.rows.length === 0 ? (
                    <tr>
                      <td colSpan={2}>—</td>
                    </tr>
                  ) : (
                    col.rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.code} — {r.name}
                        </td>
                        <td>{formatMoney(col.bal(r))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">ميزان المراجعة</h2>
        {trial.length === 0 ? (
          <EmptyState title="لا أرصدة لهذه الفترة" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الحساب</th>
                  <th>النوع</th>
                  <th>مدين</th>
                  <th>دائن</th>
                </tr>
              </thead>
              <tbody>
                {trial.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.code} — {r.name}
                    </td>
                    <td>{r.type}</td>
                    <td>{formatMoney(r.debit)}</td>
                    <td>{formatMoney(r.credit)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="font-semibold" colSpan={2}>
                    الإجمالي
                  </td>
                  <td className="font-semibold">{formatMoney(trial.reduce((s, r) => s + r.debit, 0))}</td>
                  <td className="font-semibold">{formatMoney(trial.reduce((s, r) => s + r.credit, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
