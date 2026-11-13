import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader, EmptyState, StatusBadge, Kpi } from "@/components/ui";

export default async function BankingPage() {
  const session = await getSession();
  if (!session) return null;

  const [bankAccounts, cashBoxes, vouchers] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
      include: { account: { select: { code: true, name: true } } },
    }),
    prisma.cashBox.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
      include: {
        account: { select: { code: true, name: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.voucher.findMany({
      where: { companyId: session.companyId },
      orderBy: [{ voucherDate: "desc" }, { voucherNumber: "desc" }],
      include: {
        bankAccount: { select: { name: true } },
        cashBox: { select: { name: true } },
      },
    }),
  ]);

  const totalBank = bankAccounts.reduce((s, b) => s + b.balance, 0);
  const totalCash = cashBoxes.reduce((s, c) => s + c.balance, 0);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="النقدية والبنوك" subtitle="الحسابات البنكية والصناديق والسندات" />

      <div className="stagger grid gap-4 sm:grid-cols-3">
        <Kpi label="إجمالي البنوك" value={formatMoney(totalBank)} tone="blue" />
        <Kpi label="إجمالي الصناديق" value={formatMoney(totalCash)} tone="green" />
        <Kpi label="عدد السندات" value={String(vouchers.length)} tone="navy" />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy">الحسابات البنكية</h2>
        {bankAccounts.length === 0 ? (
          <EmptyState title="لا توجد حسابات بنكية" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البنك</th>
                  <th>IBAN</th>
                  <th>الحساب المحاسبي</th>
                  <th>الرصيد</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold">{b.name}</td>
                    <td>{b.bankName || "—"}</td>
                    <td className="font-mono text-xs">{b.iban || "—"}</td>
                    <td>{b.account ? `${b.account.code} — ${b.account.name}` : "—"}</td>
                    <td className="font-semibold">{formatMoney(b.balance)}</td>
                    <td>
                      <StatusBadge status={b.isActive ? "ACTIVE" : "CANCELLED"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy">الصناديق النقدية</h2>
        {cashBoxes.length === 0 ? (
          <EmptyState title="لا توجد صناديق" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الفرع</th>
                  <th>الحساب المحاسبي</th>
                  <th>الرصيد</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {cashBoxes.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.name}</td>
                    <td>{c.branch?.name || "—"}</td>
                    <td>{c.account ? `${c.account.code} — ${c.account.name}` : "—"}</td>
                    <td className="font-semibold">{formatMoney(c.balance)}</td>
                    <td>
                      <StatusBadge status={c.isActive ? "ACTIVE" : "CANCELLED"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy">السندات</h2>
        {vouchers.length === 0 ? (
          <EmptyState title="لا توجد سندات" description="ستظهر سندات القبض والصرف والتحويل هنا" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>النوع</th>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>البنك / الصندوق</th>
                  <th>الجهة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td className="font-mono">{v.voucherNumber}</td>
                    <td>{v.voucherType}</td>
                    <td>{formatDate(v.voucherDate)}</td>
                    <td className="font-semibold">{formatMoney(v.amount)}</td>
                    <td>{v.bankAccount?.name || v.cashBox?.name || "—"}</td>
                    <td>{v.partyName || "—"}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
