import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number, currency = "SAR") {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
