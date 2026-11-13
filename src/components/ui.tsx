"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "blue",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "blue" | "green" | "orange" | "red" | "navy";
}) {
  const tones = {
    blue: "from-sky-500/10 to-transparent text-sky-700",
    green: "from-emerald-500/10 to-transparent text-emerald-700",
    orange: "from-amber-500/10 to-transparent text-amber-700",
    red: "from-red-500/10 to-transparent text-red-700",
    navy: "from-slate-500/10 to-transparent text-slate-700",
  };
  return (
    <div className={cn("kpi-card bg-gradient-to-bl", tones[tone])}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-navy">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <div className="text-lg font-semibold text-slate-700">{title}</div>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    POSTED: "badge-green",
    APPROVED: "badge-green",
    PAID: "badge-green",
    ACTIVE: "badge-green",
    PRESENT: "badge-green",
    CALCULATED: "badge-blue",
    ISSUED: "badge-blue",
    DRAFT: "badge-gray",
    PENDING: "badge-yellow",
    PARTIAL: "badge-yellow",
    PROBATION: "badge-yellow",
    REJECTED: "badge-red",
    REVERSED: "badge-red",
    ABSENT: "badge-red",
    TERMINATED: "badge-red",
    RESIGNED: "badge-red",
    CANCELLED: "badge-red",
  };
  const labels: Record<string, string> = {
    POSTED: "مرحّل",
    APPROVED: "معتمد",
    PAID: "مدفوع",
    ACTIVE: "نشط",
    PRESENT: "حاضر",
    CALCULATED: "محسوب",
    ISSUED: "صادرة",
    DRAFT: "مسودة",
    PENDING: "معلّق",
    PARTIAL: "جزئي",
    PROBATION: "تجربة",
    REJECTED: "مرفوض",
    REVERSED: "معكوس",
    ABSENT: "غائب",
    TERMINATED: "منتهي",
    RESIGNED: "استقالة",
    CANCELLED: "ملغى",
    ON_LEAVE: "إجازة",
  };
  return <span className={map[status] || "badge-gray"}>{labels[status] || status}</span>;
}

export function Alert({
  type = "info",
  children,
}: {
  type?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", styles[type])}>{children}</div>;
}
