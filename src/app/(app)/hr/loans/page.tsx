import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";

export default async function LoansPage() {
  const session = await getSession();
  if (!session) return null;
  const loans = await prisma.loan.findMany({
    where: { employee: { companyId: session.companyId } },
    include: { employee: true, schedule: { orderBy: { dueDate: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="animate-fade-up">
      <PageHeader title="السلف والقروض" subtitle="أقساط تُستقطع تلقائياً عند ترحيل مسير الرواتب" />
      <div className="space-y-4">
        {loans.map((loan) => (
          <div key={loan.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="font-semibold">{loan.employee.fullName}</span>
              <StatusBadge status={loan.status} />
              <span className="text-sm">المبلغ {formatMoney(loan.amount)}</span>
              <span className="text-sm">المتبقي {formatMoney(loan.remaining)}</span>
              <span className="text-sm text-slate-500">قسط {formatMoney(loan.installmentAmount)}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاستحقاق</th>
                  <th>المبلغ</th>
                  <th>المدفوع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loan.schedule.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.dueDate)}</td>
                    <td>{formatMoney(s.amount)}</td>
                    <td>{formatMoney(s.paidAmount)}</td>
                    <td>
                      <StatusBadge status={s.status === "PAID" ? "PAID" : "PENDING"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
