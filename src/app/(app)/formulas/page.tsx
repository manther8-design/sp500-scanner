"use client";

import { useEffect, useState } from "react";
import { PageHeader, EmptyState, Alert, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type Formula = {
  id: string;
  code: string;
  name: string;
  category: string;
  expression: string;
  version: number;
  effectiveFrom: string;
  isActive: boolean;
  description: string | null;
};

const SAMPLE_CTX: Record<string, number> = {
  basic_salary: 5000,
  total_salary: 7000,
  housing_allowance: 1500,
  monthly_hours: 176,
  ot_hours: 10,
  ot_factor: 1.5,
  ot_base: 5000,
  absent_days: 1,
  late_hours: 2,
  month_days: 30,
  service_years: 3,
  fixed_value: 6500,
};

export default function FormulasPage() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [allowedVars, setAllowedVars] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [testResult, setTestResult] = useState<string>("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "OVERTIME",
    expression: "round((ot_base / monthly_hours) * ot_hours * ot_factor, 2)",
    description: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  const [testExpr, setTestExpr] = useState(form.expression);
  const [ctxJson, setCtxJson] = useState(JSON.stringify(SAMPLE_CTX, null, 2));

  async function load() {
    const res = await fetch("/api/formulas?active=false");
    if (res.ok) {
      const data = await res.json();
      setFormulas(data.formulas || []);
      setAllowedVars(data.allowedVars || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const res = await fetch("/api/formulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل الحفظ");
      return;
    }
    setMsg(`تم إنشاء النسخة ${data.version} للمعادلة ${data.code}`);
    load();
  }

  async function runTest() {
    setError("");
    setTestResult("");
    let context: Record<string, number>;
    try {
      context = JSON.parse(ctxJson);
    } catch {
      setError("سياق الاختبار JSON غير صالح");
      return;
    }
    const res = await fetch("/api/formulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression: testExpr, context }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل الاختبار");
      return;
    }
    setTestResult(`النتيجة: ${data.rounded} (خام: ${data.value})`);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="محرك المعادلات" subtitle="تعريفات قابلة للإصدار مع تاريخ سريان — دون إعادة كتابة المسيرات السابقة" />
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

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">إصدار معادلة جديدة</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">الرمز</label>
              <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div>
              <label className="label">الاسم</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">الفئة</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["OVERTIME", "ABSENCE", "LATE", "EOS", "ALLOWANCE", "DEDUCTION", "INCENTIVE", "GOSI", "PAYROLL"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ساري من</label>
              <input className="input" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">التعبير</label>
            <textarea
              className="input min-h-[88px] font-mono text-xs"
              dir="ltr"
              value={form.expression}
              onChange={(e) => {
                setForm({ ...form, expression: e.target.value });
                setTestExpr(e.target.value);
              }}
              required
            />
          </div>
          <button type="submit" className="btn-primary">
            حفظ نسخة
          </button>
        </form>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">مختبر المعادلات</h2>
          <div>
            <label className="label">التعبير</label>
            <textarea className="input min-h-[72px] font-mono text-xs" dir="ltr" value={testExpr} onChange={(e) => setTestExpr(e.target.value)} />
          </div>
          <div>
            <label className="label">السياق (JSON)</label>
            <textarea className="input min-h-[140px] font-mono text-xs" dir="ltr" value={ctxJson} onChange={(e) => setCtxJson(e.target.value)} />
          </div>
          <button type="button" className="btn-secondary" onClick={runTest}>
            اختبار
          </button>
          {testResult && <Alert type="info">{testResult}</Alert>}
          <div className="text-xs text-slate-500">
            متغيرات مسموحة: {allowedVars.slice(0, 12).join(", ")}
            {allowedVars.length > 12 ? "…" : ""}
          </div>
        </div>
      </div>

      {formulas.length === 0 ? (
        <EmptyState title="لا معادلات" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الرمز</th>
                <th>الاسم</th>
                <th>الفئة</th>
                <th>الإصدار</th>
                <th>ساري من</th>
                <th>التعبير</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {formulas.map((f) => (
                <tr key={f.id}>
                  <td>{f.code}</td>
                  <td>{f.name}</td>
                  <td>{f.category}</td>
                  <td>v{f.version}</td>
                  <td>{formatDate(f.effectiveFrom)}</td>
                  <td className="max-w-xs truncate font-mono text-xs" dir="ltr" title={f.expression}>
                    {f.expression}
                  </td>
                  <td>
                    <StatusBadge status={f.isActive ? "ACTIVE" : "CANCELLED"} />
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
