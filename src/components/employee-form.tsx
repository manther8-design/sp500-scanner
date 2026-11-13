"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui";

export function EmployeeForm({
  branches,
  departments,
}: {
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    employeeNumber: "",
    fullName: "",
    jobTitle: "",
    basicSalary: "",
    branchId: branches[0]?.id || "",
    departmentId: departments[0]?.id || "",
    contractType: "UNLIMITED",
    phone: "",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, basicSalary: Number(form.basicSalary) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل الحفظ");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        إضافة موظف
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 font-semibold">موظف جديد</h3>
      {error && (
        <div className="mb-3">
          <Alert type="error">{error}</Alert>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label">الرقم الوظيفي</label>
          <input className="input" required value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} />
        </div>
        <div>
          <label className="label">الاسم الكامل</label>
          <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <label className="label">المسمى الوظيفي</label>
          <input className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
        </div>
        <div>
          <label className="label">الراتب الأساسي</label>
          <input className="input" type="number" required value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
        </div>
        <div>
          <label className="label">الفرع</label>
          <select className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">القسم</label>
          <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-primary" type="submit">
          حفظ
        </button>
        <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>
          إلغاء
        </button>
      </div>
    </form>
  );
}
