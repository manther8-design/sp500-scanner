"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, EmptyState, Alert, Kpi } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type Item = {
  id: string;
  basicSalary: number;
  totalAllowances: number;
  totalOvertime: number;
  totalIncentives: number;
  grossSalary: number;
  totalDeductions: number;
  gosiEmployee: number;
  loanDeduction: number;
  netSalary: number;
  workingDays: number;
  absentDays: number;
  otHours: number;
  breakdownJson: string | null;
  employee: { id: string; employeeNumber: string; fullName: string };
};

type Run = {
  id: string;
  year: number;
  month: number;
  runNumber: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  items: Item[];
};

export default function PayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/payroll");
    if (res.ok) {
      const data: Run[] = await res.json();
      setRuns(data);
      if (selected) {
        const refreshed = data.find((r) => r.id === selected.id);
        setSelected(refreshed || data[0] || null);
      } else if (data[0]) {
        setSelected(data[0]);
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "فشل العملية");
      return;
    }
    if (payload.action === "calculate") setMsg(`تم احتساب المسير ${data.runNumber}`);
    if (payload.action === "approve") setMsg("تم اعتماد المسير");
    if (payload.action === "post") setMsg("تم ترحيل المسير محاسبياً");
    setSelected(data.items ? data : selected);
    await load();
    if (data.id) {
      const full = await fetch(`/api/payroll?id=${data.id}`);
      if (full.ok) setSelected(await full.json());
    }
  }

  const openBreakdown = selected?.items.find((i) => i.id === breakdownId);
  let breakdown: Record<string, unknown> | null = null;
  if (openBreakdown?.breakdownJson) {
    try {
      breakdown = JSON.parse(openBreakdown.breakdownJson);
    } catch {
      breakdown = null;
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="مسير الرواتب"
        subtitle="احتساب · اعتماد · ترحيل محاسبي"
        actions={
          <div className="flex flex-wrap gap-2">
            <select className="input w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  شهر {i + 1}
                </option>
              ))}
            </select>
            <input className="input w-24" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            <button className="btn-primary" disabled={busy} onClick={() => action({ action: "calculate", year, month })}>
              احتساب
            </button>
            {selected?.status === "CALCULATED" && (
              <button className="btn-secondary" disabled={busy} onClick={() => action({ action: "approve", id: selected.id })}>
                اعتماد
              </button>
            )}
            {selected?.status === "APPROVED" && (
              <button className="btn-primary" disabled={busy} onClick={() => action({ action: "post", id: selected.id })}>
                ترحيل محاسبي
              </button>
            )}
          </div>
        }
      />

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

      {runs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`rounded-xl border px-3 py-2 text-sm ${selected?.id === r.id ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 bg-white"}`}
            >
              {r.runNumber} <StatusBadge status={r.status} />
            </button>
          ))}
        </div>
      )}

      {!selected ? (
        <EmptyState title="لا مسيرات بعد" description="اختر السنة والشهر ثم اضغط احتساب" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Kpi label="إجمالي المستحق" value={formatMoney(selected.totalGross)} tone="blue" />
            <Kpi label="الاستقطاعات" value={formatMoney(selected.totalDeductions)} tone="orange" />
            <Kpi label="صافي المسير" value={formatMoney(selected.totalNet)} tone="green" />
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>أساسي</th>
                  <th>بدلات</th>
                  <th>إضافي</th>
                  <th>حوافز</th>
                  <th>إجمالي</th>
                  <th>استقطاعات</th>
                  <th>صافي</th>
                  <th>تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="font-medium">{i.employee.fullName}</div>
                      <div className="text-xs text-slate-400">{i.employee.employeeNumber}</div>
                    </td>
                    <td>{formatMoney(i.basicSalary)}</td>
                    <td>{formatMoney(i.totalAllowances)}</td>
                    <td>{formatMoney(i.totalOvertime)}</td>
                    <td>{formatMoney(i.totalIncentives)}</td>
                    <td>{formatMoney(i.grossSalary)}</td>
                    <td>{formatMoney(i.totalDeductions)}</td>
                    <td className="font-semibold">{formatMoney(i.netSalary)}</td>
                    <td>
                      <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setBreakdownId(i.id)}>
                        تفصيل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {openBreakdown && breakdown && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 font-semibold text-navy">تفاصيل احتساب — {openBreakdown.employee.fullName}</h3>
              <pre className="overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700" dir="ltr">
                {JSON.stringify(breakdown, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
