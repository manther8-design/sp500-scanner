"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, StatusBadge, Alert } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";

type Category = { id: string; code: string; name: string };
type Expense = {
  id: string;
  expenseDate: string;
  amount: number;
  description: string | null;
  status: string;
  category?: Category;
  branch?: { name: string } | null;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "BANK",
  });

  async function load() {
    const data = await (await fetch("/api/expenses")).json();
    setExpenses(data.expenses || []);
    setCategories(data.categories || []);
    if (!form.categoryId && data.categories?.[0]) {
      setForm((f) => ({ ...f, categoryId: data.categories[0].id }));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy("create");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التسجيل");
      setMsg("تم تسجيل المصروف كمسودة");
      setForm((f) => ({ ...f, amount: "", description: "" }));
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "خطأ");
    } finally {
      setBusy(null);
    }
  }

  async function approve(id: string) {
    setErr("");
    setMsg("");
    setBusy(id);
    try {
      const res = await fetch(`/api/expenses/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الاعتماد");
      setMsg("تم اعتماد المصروف وترحيله محاسبياً");
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "خطأ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="المصروفات" subtitle="تسجيل واعتماد المصروفات مع القيود المحاسبية" />
      {msg && (
        <div className="mb-4">
          <Alert type="success">{msg}</Alert>
        </div>
      )}
      {err && (
        <div className="mb-4">
          <Alert type="error">{err}</Alert>
        </div>
      )}
      <form onSubmit={create} className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label">التصنيف</label>
          <select
            className="input"
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">المبلغ</label>
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="المبلغ"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label">التاريخ</label>
          <input
            className="input"
            type="date"
            value={form.expenseDate}
            onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
          />
        </div>
        <div>
          <label className="label">طريقة الدفع</label>
          <select
            className="input"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          >
            <option value="BANK">بنك</option>
            <option value="CASH">نقداً</option>
          </select>
        </div>
        <div>
          <label className="label">الوصف</label>
          <input
            className="input"
            placeholder="الوصف"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <button className="btn-primary sm:col-span-2 lg:col-span-5" disabled={busy === "create"}>
          {busy === "create" ? "جاري الحفظ..." : "تسجيل مصروف"}
        </button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>التصنيف</th>
              <th>المبلغ</th>
              <th>الوصف</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
                  لا توجد مصروفات بعد
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.expenseDate)}</td>
                  <td>{e.category?.name}</td>
                  <td>{formatMoney(e.amount)}</td>
                  <td>{e.description || "—"}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td>
                    {(e.status === "DRAFT" || e.status === "PENDING") && (
                      <button className="btn-primary" disabled={busy === e.id} onClick={() => approve(e.id)}>
                        {busy === e.id ? "جاري الاعتماد..." : "اعتماد وترحيل"}
                      </button>
                    )}
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
