export function StatPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "up" | "down" | "warn";
}) {
  const toneClass =
    tone === "up"
      ? "text-signal-up"
      : tone === "down"
        ? "text-signal-down"
        : tone === "warn"
          ? "text-signal-wait"
          : "text-white";

  return (
    <div className="animate-rise rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-xs text-mist-200/70">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
