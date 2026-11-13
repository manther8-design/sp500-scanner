"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, Alert } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string;
  workDate: string;
  hours: number;
  otType: string;
  reason?: string | null;
  status: string;
  employee: { fullName: string };
};

export default function OvertimePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setRows(await (await fetch("/api/overtime")).json());
  }
  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    const res = await fetch("/api/overtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", id }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setMsg("تم اعتماد الإضافي — سيُحتسب في المسير التالي");
      load();
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="العمل الإضافي" subtitle="معاملات قابلة للتهيئة عبر محرك المعادلات وسياسة الدوام" />
      {msg && (
        <div className="mb-4">
          <Alert type="success">{msg}</Alert>
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>التاريخ</th>
              <th>الساعات</th>
              <th>النوع</th>
              <th>السبب</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.employee.fullName}</td>
                <td>{formatDate(r.workDate)}</td>
                <td>{r.hours}</td>
                <td>{r.otType}</td>
                <td>{r.reason || "—"}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>
                  {r.status === "PENDING" && (
                    <button className="btn-primary" onClick={() => approve(r.id)}>
                      اعتماد
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
