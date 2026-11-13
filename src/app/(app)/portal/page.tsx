import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDate } from "@/lib/utils";
import { PageHeader, StatusBadge, EmptyState, Alert, Kpi } from "@/components/ui";

export default async function PortalPage() {
  const session = await getSession();
  if (!session) return null;

  const employee = await prisma.employee.findFirst({
    where: { userId: session.userId, companyId: session.companyId },
    include: {
      branch: true,
      department: true,
      allowances: { where: { isActive: true }, include: { allowanceType: true } },
      leaveBalances: { include: { leaveType: true } },
      leaveRequests: { include: { leaveType: true }, orderBy: { createdAt: "desc" }, take: 10 },
      overtime: { orderBy: { createdAt: "desc" }, take: 10 },
      loans: { include: { schedule: { orderBy: { dueDate: "asc" } } }, orderBy: { createdAt: "desc" } },
      payrollItems: {
        include: { payrollRun: true },
        orderBy: { payrollRun: { year: "desc" } },
        take: 6,
      },
    },
  });

  if (!employee) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="بوابة الموظف" subtitle={session.fullName} />
        <Alert type="warning">
          حسابك غير مرتبط بسجل موظف. تواصل مع الموارد البشرية لربط المستخدم بالموظف (userId).
        </Alert>
      </div>
    );
  }

  const year = new Date().getFullYear();
  const balances = employee.leaveBalances.filter((b) => b.year === year);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="بوابة الموظف"
        subtitle={`${employee.fullName} · ${employee.employeeNumber}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="الراتب الأساسي" value={formatMoney(employee.basicSalary)} tone="blue" />
        <Kpi label="الحالة" value={employee.employmentStatus} />
        <Kpi label="الفرع" value={employee.branch?.name || "—"} />
        <Kpi label="القسم" value={employee.department?.name || "—"} />
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-navy">بياناتي</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-slate-500">المسمى: </span>
            {employee.jobTitle || "—"}
          </div>
          <div>
            <span className="text-slate-500">التعيين: </span>
            {formatDate(employee.hireDate)}
          </div>
          <div>
            <span className="text-slate-500">الجوال: </span>
            {employee.phone || "—"}
          </div>
          <div>
            <span className="text-slate-500">البريد: </span>
            {employee.email || "—"}
          </div>
          <div>
            <span className="text-slate-500">IBAN: </span>
            {employee.bankIban || "—"}
          </div>
          <div>
            <span className="text-slate-500">البدلات: </span>
            {employee.allowances.length
              ? employee.allowances.map((a) => `${a.allowanceType.name} ${formatMoney(a.value)}`).join(" · ")
              : "—"}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold text-navy">أرصدة الإجازات {year}</h2>
        {balances.length === 0 ? (
          <EmptyState title="لا أرصدة" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>المستحق</th>
                  <th>المستخدم</th>
                  <th>المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.id}>
                    <td>{b.leaveType.name}</td>
                    <td>{b.entitled}</td>
                    <td>{b.used}</td>
                    <td>{b.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold text-navy">طلبات الإجازة</h2>
          {employee.leaveRequests.length === 0 ? (
            <EmptyState title="لا طلبات" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>الفترة</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.leaveRequests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.leaveType.name}</td>
                      <td>
                        {formatDate(r.startDate)} — {formatDate(r.endDate)}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-semibold text-navy">العمل الإضافي</h2>
          {employee.overtime.length === 0 ? (
            <EmptyState title="لا طلبات" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>ساعات</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.overtime.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDate(o.workDate)}</td>
                      <td>{o.hours}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold text-navy">قسائم الرواتب</h2>
        {employee.payrollItems.length === 0 ? (
          <EmptyState title="لا قسائم بعد" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المسير</th>
                  <th>إجمالي</th>
                  <th>استقطاعات</th>
                  <th>صافي</th>
                  <th>حالة المسير</th>
                </tr>
              </thead>
              <tbody>
                {employee.payrollItems.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.payrollRun.runNumber} ({i.payrollRun.year}/{i.payrollRun.month})
                    </td>
                    <td>{formatMoney(i.grossSalary)}</td>
                    <td>{formatMoney(i.totalDeductions)}</td>
                    <td className="font-semibold">{formatMoney(i.netSalary)}</td>
                    <td>
                      <StatusBadge status={i.payrollRun.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-navy">السلف / القروض</h2>
        {employee.loans.length === 0 ? (
          <EmptyState title="لا سلف" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المبلغ</th>
                  <th>المتبقي</th>
                  <th>الأقساط</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {employee.loans.map((l) => (
                  <tr key={l.id}>
                    <td>{formatMoney(l.amount)}</td>
                    <td>{formatMoney(l.remaining)}</td>
                    <td>
                      {l.paidInstallments}/{l.installments}
                    </td>
                    <td>
                      <StatusBadge status={l.status} />
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
