import { fmtPct } from "@/lib/api";

export function ChangeCell({ value }: { value?: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-mist-200/50">—</span>;
  }
  const tone = value > 0 ? "text-signal-up" : value < 0 ? "text-signal-down" : "text-mist-100";
  return <span className={`tabular-nums ${tone}`}>{fmtPct(value)}</span>;
}
