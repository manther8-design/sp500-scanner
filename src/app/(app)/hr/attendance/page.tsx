"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type Rec = {
  id: string;
  workDate: string;
  checkIn?: string | null;
  checkOut?: string | null;
  lateMinutes: number;
  workedHours: number;
  status: string;
  employee: { fullName: string; employeeNumber: string };
};

export default function AttendancePage() {
  const [rows, setRows] = useState<Rec[]>([]);

  useEffect(() => {
    fetch("/api/attendance?year=2026&month=11")
      .then((r) => r.json())
      .then(setRows);
  }, []);

  return (
    <div className="animate-fade-up">
      <PageHeader title="الحضور والانصراف" subtitle="نوفمبر 2026 — يغذي محرك الخصومات والعمل الإضافي في مسير الرواتب" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الموظف</th>
              <th>حضور</th>
              <th>انصراف</th>
              <th>تأخير (د)</th>
              <th>ساعات</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.workDate)}</td>
                <td>
                  {r.employee.fullName}
                  <div className="text-xs text-slate-400">{r.employee.employeeNumber}</div>
                </td>
                <td>{r.checkIn || "—"}</td>
                <td>{r.checkOut || "—"}</td>
                <td>{r.lateMinutes}</td>
                <td>{r.workedHours}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
