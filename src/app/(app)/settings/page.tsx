import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, Alert } from "@/components/ui";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const [company, saudi, policies] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.companyId },
      include: { organization: true, branches: { where: { isActive: true } } },
    }),
    prisma.saudiComplianceSettings.findUnique({ where: { companyId: session.companyId } }),
    prisma.workPolicy.findMany({
      where: { companyId: session.companyId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  if (!company) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="الإعدادات" />
        <EmptyState title="الشركة غير موجودة" />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="الإعدادات" subtitle="بيانات الشركة والامتثال السعودي وسياسات العمل" />

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-navy">الشركة</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <div className="text-slate-500">الاسم</div>
            <div className="font-medium">{company.name}</div>
          </div>
          <div>
            <div className="text-slate-500">الرمز</div>
            <div className="font-medium">{company.code}</div>
          </div>
          <div>
            <div className="text-slate-500">المنظمة</div>
            <div className="font-medium">{company.organization.name}</div>
          </div>
          <div>
            <div className="text-slate-500">السجل التجاري</div>
            <div className="font-medium">{company.commercialReg || "—"}</div>
          </div>
          <div>
            <div className="text-slate-500">الرقم الضريبي</div>
            <div className="font-medium">{company.taxNumber || "—"}</div>
          </div>
          <div>
            <div className="text-slate-500">العملة / الدولة</div>
            <div className="font-medium">
              {company.currency} · {company.country}
            </div>
          </div>
          <div>
            <div className="text-slate-500">بداية السنة المالية (شهر)</div>
            <div className="font-medium">{company.fiscalYearStart}</div>
          </div>
          <div>
            <div className="text-slate-500">الفروع النشطة</div>
            <div className="font-medium">{company.branches.map((b) => b.name).join("، ") || "—"}</div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-navy">الامتثال السعودي</h2>
        {!saudi ? (
          <Alert type="warning">لم تُعرّف إعدادات الامتثال بعد لهذه الشركة.</Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <div className="text-slate-500">نسبة تأمينات الموظف</div>
              <div className="font-medium">{saudi.gosiEmployeeRate}%</div>
            </div>
            <div>
              <div className="text-slate-500">نسبة تأمينات المنشأة</div>
              <div className="font-medium">{saudi.gosiEmployerRate}%</div>
            </div>
            <div>
              <div className="text-slate-500">ضريبة القيمة المضافة</div>
              <div className="font-medium">{saudi.vatRate}%</div>
            </div>
            <div>
              <div className="text-slate-500">الإجازة السنوية (أيام)</div>
              <div className="font-medium">{saudi.annualLeaveDays}</div>
            </div>
            <div>
              <div className="text-slate-500">معامل إضافي أيام العمل</div>
              <div className="font-medium">{saudi.otWeekdayFactor}</div>
            </div>
            <div>
              <div className="text-slate-500">معامل إضافي العطل</div>
              <div className="font-medium">{saudi.otHolidayFactor}</div>
            </div>
            <div>
              <div className="text-slate-500">ZATCA</div>
              <div className="font-medium">{saudi.zatcaEnabled ? "مفعّل" : "غير مفعّل"}</div>
            </div>
            <div>
              <div className="text-slate-500">WPS</div>
              <div className="font-medium">{saudi.wpsEnabled ? "مفعّل" : "غير مفعّل"}</div>
            </div>
            {saudi.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="text-slate-500">ملاحظات</div>
                <div className="font-medium">{saudi.notes}</div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-navy">سياسات العمل</h2>
        {policies.length === 0 ? (
          <EmptyState title="لا سياسات عمل" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>ساعات يومية</th>
                  <th>أيام أسبوعية</th>
                  <th>ساعات شهرية</th>
                  <th>الدوام</th>
                  <th>إضافي</th>
                  <th>افتراضي</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.dailyHours}</td>
                    <td>{p.weeklyDays}</td>
                    <td>{p.monthlyHours}</td>
                    <td>
                      {p.workStart} — {p.workEnd}
                    </td>
                    <td className="text-xs">
                      عمل {p.otWeekdayFactor} · نهاية أسبوع {p.otWeekendFactor} · عطلة {p.otHolidayFactor}
                    </td>
                    <td>{p.isDefault ? "نعم" : "لا"}</td>
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
