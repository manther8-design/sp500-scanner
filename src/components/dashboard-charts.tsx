"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#0284C7", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#14B8A6"];

export function DashboardCharts({
  monthly,
  expenses,
  branches,
}: {
  monthly: { label: string; revenue: number; expense: number; profit: number }[];
  expenses: { name: string; value: number }[];
  branches: { name: string; employees: number; salaryBase: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-semibold text-navy">الإيرادات والمصروفات والأرباح</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="revenue" name="إيرادات" fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="مصروفات" fill="#F59E0B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-semibold text-navy">تطور الأرباح شهرياً</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="profit" name="صافي الربح" stroke="#0284C7" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-semibold text-navy">المصروفات حسب التصنيف</h3>
        <div className="h-72">
          {expenses.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">لا توجد مصروفات في الفترة</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenses} dataKey="value" nameKey="name" outerRadius={100} label>
                  {expenses.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-semibold text-navy">مقارنة أداء الفروع (تكلفة رواتب أساسية)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={branches}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="salaryBase" name="أساسيات الرواتب" fill="#0284C7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="employees" name="عدد الموظفين" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
