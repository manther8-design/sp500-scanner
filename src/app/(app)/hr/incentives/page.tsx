import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export default async function IncentivesPage() {
  const session = await getSession();
  if (!session) return null;
  const [types, items] = await Promise.all([
    prisma.incentiveType.findMany({ where: { companyId: session.companyId } }),
    prisma.employeeIncentive.findMany({
      where: { employee: { companyId: session.companyId } },
      include: { employee: true, incentiveType: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="الحوافز والمكافآت" subtitle="تُرحَّل تلقائياً إلى مسير الرواتب بعد الاعتماد" />
      <div className="mb-4 flex flex-wrap gap-2">
        {types.map((t) => (
          <span key={t.id} className="badge-blue">
            {t.name} · {t.calcMethod} · {t.frequency}
          </span>
        ))}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>الفترة</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.employee.fullName}</td>
                <td>{i.incentiveType.name}</td>
                <td>{formatMoney(i.amount)}</td>
                <td>{i.period || "—"}</td>
                <td>
                  <StatusBadge status={i.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
