"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";

const LINKS = [
  { href: "/dashboard", label: "لوحة التحكم", group: "تنقل" },
  { href: "/sales", label: "المبيعات والفواتير", group: "تنقل" },
  { href: "/pos", label: "نقطة البيع POS", group: "تنقل" },
  { href: "/inventory", label: "المخازن والأصناف", group: "تنقل" },
  { href: "/purchases", label: "المشتريات", group: "تنقل" },
  { href: "/accounting/journals", label: "القيود اليومية", group: "تنقل" },
  { href: "/accounting/accounts", label: "دليل الحسابات", group: "تنقل" },
  { href: "/hr/employees", label: "الموظفون", group: "تنقل" },
  { href: "/payroll", label: "مسير الرواتب", group: "تنقل" },
  { href: "/formulas", label: "محرك المعادلات", group: "تنقل" },
  { href: "/analytics", label: "التحليل المالي", group: "تنقل" },
  { href: "/ai-assistant", label: "المساعد الذكي", group: "تنقل" },
  { href: "/reports", label: "التقارير", group: "تنقل" },
  { href: "/settings", label: "الإعدادات", group: "تنقل" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ type: string; id: string; label: string; href: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh]" onClick={() => onOpenChange(false)}>
      <Command
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        shouldFilter={false}
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="ابحث أو انتقل بسرعة..."
          className="w-full border-b border-slate-100 px-4 py-3 text-sm outline-none"
          autoFocus
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-slate-400">لا نتائج</Command.Empty>
          {results.length > 0 && (
            <Command.Group heading="نتائج البحث" className="px-2 py-1 text-xs font-semibold text-slate-400">
              {results.map((r) => (
                <Command.Item
                  key={`${r.type}-${r.id}`}
                  value={r.label}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(r.href);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm aria-selected:bg-sky-50"
                >
                  <span>{r.label}</span>
                  <span className="badge-gray">{r.type}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="الصفحات" className="px-2 py-1 text-xs font-semibold text-slate-400">
            {LINKS.filter((l) => !query || l.label.includes(query)).map((l) => (
              <Command.Item
                key={l.href}
                value={l.label}
                onSelect={() => {
                  onOpenChange(false);
                  router.push(l.href);
                }}
                className="cursor-pointer rounded-xl px-3 py-2 text-sm aria-selected:bg-sky-50"
              >
                {l.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
