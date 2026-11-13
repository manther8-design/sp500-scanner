import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { AccountForm } from "@/components/account-form";

const typeLabel: Record<string, string> = {
  ASSET: "أصول",
  LIABILITY: "التزامات",
  EQUITY: "حقوق ملكية",
  REVENUE: "إيرادات",
  EXPENSE: "مصروفات",
};

export default async function AccountsPage() {
  const session = await getSession();
  if (!session) return null;
  const accounts = await prisma.account.findMany({
    where: { companyId: session.companyId },
    orderBy: { code: "asc" },
  });

  return (
    <div className="animate-fade-up">
      <PageHeader title="دليل الحسابات" subtitle="هيكل محاسبي هرمي مع منع حذف الحسابات المستخدمة" />
      <AccountForm accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} />
      <div className="table-wrap mt-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>الرمز</th>
              <th>الاسم</th>
              <th>النوع</th>
              <th>الطبيعة</th>
              <th>المستوى</th>
              <th>قابل للترحيل</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs" style={{ paddingInlineStart: `${(a.level - 1) * 12}px` }}>
                  {a.code}
                </td>
                <td className={a.isPostable ? "" : "font-semibold"}>{a.name}</td>
                <td>{typeLabel[a.type] || a.type}</td>
                <td>{a.nature === "DEBIT" ? "مدين" : "دائن"}</td>
                <td>{a.level}</td>
                <td>{a.isPostable ? "نعم" : "لا"}</td>
                <td>
                  <StatusBadge status={a.isActive ? "ACTIVE" : "CANCELLED"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
