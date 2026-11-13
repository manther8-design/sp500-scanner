"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AccountForm({ accounts }: { accounts: { id: string; code: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "EXPENSE",
    nature: "DEBIT",
    parentId: "",
    isPostable: true,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, parentId: form.parentId || null }),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "فشل");
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        إضافة حساب
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label">رقم الحساب</label>
          <input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div>
          <label className="label">اسم الحساب</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">النوع</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="ASSET">أصول</option>
            <option value="LIABILITY">التزامات</option>
            <option value="EQUITY">حقوق ملكية</option>
            <option value="REVENUE">إيرادات</option>
            <option value="EXPENSE">مصروفات</option>
          </select>
        </div>
        <div>
          <label className="label">الطبيعة</label>
          <select className="input" value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}>
            <option value="DEBIT">مدين</option>
            <option value="CREDIT">دائن</option>
          </select>
        </div>
        <div>
          <label className="label">الحساب الأب</label>
          <select className="input" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">— بدون —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
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
