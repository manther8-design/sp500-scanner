"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, EmptyState, Alert } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";

type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  jobTitle: string | null;
  employmentStatus: string;
  basicSalary: number;
  hireDate: string | null;
  phone: string | null;
  branch?: { name: string } | null;
  department?: { name: string } | null;
  allowances: { value: number; allowanceType: { name: string; code: string } }[];
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    employeeNumber: "",
    fullName: "",
    jobTitle: "",
    basicSalary: "",
    phone: "",
    email: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/employees");
    if (!res.ok) {
      setError("تعذر تحميل الموظفين");
      setLoading(false);
      return;
    }
    setEmployees(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        basicSalary: Number(form.basicSalary) || 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل الإنشاء");
      return;
    }
    setMsg(`تم إنشاء الموظف ${data.fullName}`);
    setForm({ employeeNumber: "", fullName: "", jobTitle: "", basicSalary: "", phone: "", email: "" });
    load();
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="الموظفون" subtitle="إدارة بيانات الموظفين والبدلات المرتبطة" />
      {error && (
        <div className="mb-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}
      {msg && (
        <div className="mb-4">
          <Alert type="success">{msg}</Alert>
        </div>
      )}

      <form onSubmit={createEmployee} className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="label">رقم الموظف</label>
          <input className="input" value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} required />
        </div>
        <div>
          <label className="label">الاسم</label>
          <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </div>
        <div>
          <label className="label">المسمى</label>
          <input className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
        </div>
        <div>
          <label className="label">الراتب الأساسي</label>
          <input className="input" type="number" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
        </div>
        <div>
          <label className="label">الجوال</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">إضافة موظف</button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">جاري التحميل...</p>
      ) : employees.length === 0 ? (
        <EmptyState title="لا يوجد موظفون" description="أضف أول موظف من النموذج أعلاه" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>الاسم</th>
                <th>الفرع</th>
                <th>القسم</th>
                <th>الراتب</th>
                <th>البدلات</th>
                <th>التعيين</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.employeeNumber}</td>
                  <td>
                    <div className="font-medium">{e.fullName}</div>
                    <div className="text-xs text-slate-400">{e.jobTitle || "—"}</div>
                  </td>
                  <td>{e.branch?.name || "—"}</td>
                  <td>{e.department?.name || "—"}</td>
                  <td>{formatMoney(e.basicSalary)}</td>
                  <td className="text-xs">
                    {e.allowances.length
                      ? e.allowances.map((a) => `${a.allowanceType.name}: ${formatMoney(a.value)}`).join(" · ")
                      : "—"}
                  </td>
                  <td>{formatDate(e.hireDate)}</td>
                  <td>
                    <StatusBadge status={e.employmentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
