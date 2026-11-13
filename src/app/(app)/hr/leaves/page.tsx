import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function LeavesPage() {
  const session = await getSession();
  if (!session) return null;
  const [types, balances, requests] = await Promise.all([
    prisma.leaveType.findMany({ where: { companyId: session.companyId } }),
    prisma.leaveBalance.findMany({
      where: { employee: { companyId: session.companyId } },
      include: { employee: true, leaveType: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employee: { companyId: session.companyId } },
      include: { employee: true, leaveType: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="الإجازات" subtitle="أرصدة وطلبات وأنواع قابلة للإضافة" />
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <span key={t.id} className="badge-blue">
            {t.name} {t.annualDays ? `(${t.annualDays})` : ""} {t.isPaid ? "" : "· بدون راتب"}
          </span>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>النوع</th>
              <th>المستحق</th>
              <th>المستخدم</th>
              <th>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.id}>
                <td>{b.employee.fullName}</td>
                <td>{b.leaveType.name}</td>
                <td>{b.entitled}</td>
                <td>{b.used}</td>
                <td>{b.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>النوع</th>
              <th>من</th>
              <th>إلى</th>
              <th>الأيام</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-400">
                  لا توجد طلبات إجازة حالياً
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee.fullName}</td>
                  <td>{r.leaveType.name}</td>
                  <td>{formatDate(r.startDate)}</td>
                  <td>{formatDate(r.endDate)}</td>
                  <td>{r.days}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
