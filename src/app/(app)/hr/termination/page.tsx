"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, StatusBadge, Alert } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";

export default function TerminationPage() {
  type Emp = { id: string; employeeNumber: string; fullName: string };
  type Term = {
    id: string;
    reason: string;
    lastWorkDate: string;
    eosAmount: number;
    leavePay: number;
    netSettlement: number;
    status: string;
    employee: { fullName: string };
  };
  const [terminations, setTerminations] = useState<Term[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    reason: "CONTRACT_END",
    lastWorkDate: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const data = await (await fetch("/api/termination")).json();
    setTerminations(data.terminations || []);
    setEmployees(data.employees || []);
    if (!form.employeeId && data.employees?.[0]) setForm((f) => ({ ...f, employeeId: data.employees[0].id }));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function calculate(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/termination", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setMsg(`تم احتساب التسوية — الصافي ${data.netSettlement}`);
      load();
    }
  }

  async function approve(id: string) {
    const res = await fetch("/api/termination", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", id }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setMsg("تم اعتماد التسوية وترحيلها وإصدار شهادة الخدمة");
      load();
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="نهاية الخدمة" subtitle="معادلات قابلة للتهيئة وفق سياسات المنشأة / نموذج سعودي قابل للتحديث" />
      {msg && (
        <div className="mb-4">
          <Alert type="info">{msg}</Alert>
        </div>
      )}
      <form onSubmit={calculate} className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
        <select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employeeNumber} — {e.fullName}
            </option>
          ))}
        </select>
        <select className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
          <option value="CONTRACT_END">انتهاء العقد</option>
          <option value="RESIGNATION">استقالة</option>
          <option value="TERMINATION">إنهاء من المنشأة</option>
          <option value="MUTUAL">اتفاق الطرفين</option>
        </select>
        <input className="input" type="date" value={form.lastWorkDate} onChange={(e) => setForm({ ...form, lastWorkDate: e.target.value })} />
        <button className="btn-primary">احتساب التسوية</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>آخر يوم</th>
              <th>السبب</th>
              <th>مكافأة نهاية الخدمة</th>
              <th>بدل إجازات</th>
              <th>صافي التسوية</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {terminations.map((t) => (
              <tr key={t.id}>
                <td>{t.employee.fullName}</td>
                <td>{formatDate(t.lastWorkDate)}</td>
                <td>{t.reason}</td>
                <td>{formatMoney(t.eosAmount)}</td>
                <td>{formatMoney(t.leavePay)}</td>
                <td className="font-semibold">{formatMoney(t.netSettlement)}</td>
                <td>
                  <StatusBadge status={t.status === "POSTED" ? "POSTED" : "DRAFT"} />
                </td>
                <td>
                  {t.status === "DRAFT" && (
                    <button className="btn-primary" onClick={() => approve(t.id)}>
                      اعتماد وترحيل
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
