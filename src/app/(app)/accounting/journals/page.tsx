"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, Alert } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";

type Account = { id: string; code: string; name: string; isPostable: boolean };
type Line = { accountId: string; debit: number; credit: number; description: string };
type Journal = {
  id: string;
  entryNumber: string;
  entryDate: string;
  entryType: string;
  description?: string | null;
  status: string;
  totalDebit: number;
  totalCredit: number;
  lines: { account: Account; debit: number; credit: number; description?: string | null }[];
};

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    description: "",
    entryDate: new Date().toISOString().slice(0, 10),
    lines: [
      { accountId: "", debit: 0, credit: 0, description: "" },
      { accountId: "", debit: 0, credit: 0, description: "" },
    ] as Line[],
  });

  async function load() {
    const [j, a] = await Promise.all([fetch("/api/journals"), fetch("/api/accounts")]);
    setJournals(await j.json());
    setAccounts((await a.json()).filter((x: Account) => x.isPostable));
  }

  useEffect(() => {
    load();
  }, []);

  function updateLine(i: number, patch: Partial<Line>) {
    setForm((f) => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], ...patch };
      return { ...f, lines };
    });
  }

  async function create() {
    setMsg("");
    const res = await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "فشل");
      return;
    }
    setMsg(`تم إنشاء القيد ${data.entryNumber}`);
    load();
  }

  async function act(id: string, action: string) {
    const res = await fetch(`/api/journals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "فشل");
    else {
      setMsg(`تم تنفيذ: ${action}`);
      load();
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="القيود اليومية" subtitle="قيد مزدوج — لا ترحيل لغير المتوازن · العكس بدل الحذف" />
      {msg && (
        <div className="mb-4">
          <Alert type={msg.includes("فشل") || msg.includes("غير") ? "error" : "success"}>{msg}</Alert>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold">قيد جديد</h3>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">التاريخ</label>
            <input className="input" type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          </div>
          <div>
            <label className="label">البيان</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        {form.lines.map((l, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-4">
            <select className="input" value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}>
              <option value="">الحساب</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            <input className="input" type="number" placeholder="مدين" value={l.debit || ""} onChange={(e) => updateLine(i, { debit: Number(e.target.value), credit: 0 })} />
            <input className="input" type="number" placeholder="دائن" value={l.credit || ""} onChange={(e) => updateLine(i, { credit: Number(e.target.value), debit: 0 })} />
            <input className="input" placeholder="وصف السطر" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
          </div>
        ))}
        <div className="mt-3 flex gap-2">
          <button className="btn-secondary" type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { accountId: "", debit: 0, credit: 0, description: "" }] })}>
            سطر إضافي
          </button>
          <button className="btn-primary" onClick={create}>
            حفظ مسودة
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {journals.map((j) => (
          <div key={j.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-semibold">{j.entryNumber}</span>
              <span className="text-sm text-slate-500">{formatDate(j.entryDate)}</span>
              <StatusBadge status={j.status} />
              <span className="badge-gray">{j.entryType}</span>
              <span className="text-sm">{j.description}</span>
              <span className="mr-auto text-sm">
                {formatMoney(j.totalDebit)} / {formatMoney(j.totalCredit)}
              </span>
              {j.status === "DRAFT" && (
                <button className="btn-secondary" onClick={() => act(j.id, "approve")}>
                  اعتماد
                </button>
              )}
              {(j.status === "DRAFT" || j.status === "APPROVED") && (
                <button className="btn-primary" onClick={() => act(j.id, "post")}>
                  ترحيل
                </button>
              )}
              {j.status === "POSTED" && (
                <button className="btn-danger" onClick={() => act(j.id, "reverse")}>
                  عكس القيد
                </button>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الحساب</th>
                  <th>مدين</th>
                  <th>دائن</th>
                  <th>البيان</th>
                </tr>
              </thead>
              <tbody>
                {j.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td>
                      {l.account.code} — {l.account.name}
                    </td>
                    <td>{l.debit ? formatMoney(l.debit) : "—"}</td>
                    <td>{l.credit ? formatMoney(l.credit) : "—"}</td>
                    <td>{l.description || "—"}</td>
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
