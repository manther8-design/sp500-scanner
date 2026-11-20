"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChangeCell } from "@/components/ChangeCell";
import { StatPill } from "@/components/StatPill";
import {
  api,
  DashboardSummary,
  fmtNum,
  fmtVol,
  WatchlistItem,
} from "@/lib/api";

function SymbolRow({ item }: { item: WatchlistItem }) {
  const symbol = item.stock?.symbol || "—";
  return (
    <tr className="table-row-hover border-b border-white/5">
      <td className="px-3 py-3">
        <Link href={`/stocks/${symbol}`} className="font-semibold text-white hover:text-accent">
          {symbol}
        </Link>
        <div className="text-xs text-mist-200/60">{item.stock?.name || ""}</div>
      </td>
      <td className="px-3 py-3 tabular-nums">{fmtNum(item.quote?.price)}</td>
      <td className="px-3 py-3">
        <ChangeCell value={item.quote?.change_percent} />
      </td>
      <td className="px-3 py-3 tabular-nums text-mist-100">{fmtVol(item.quote?.volume)}</td>
      <td className="px-3 py-3 text-xs text-mist-200/70">
        {item.quote?.completeness != null
          ? `${Math.round(item.quote.completeness * 100)}%`
          : "—"}
      </td>
    </tr>
  );
}

function MiniTable({ title, items }: { title: string; items: WatchlistItem[] }) {
  return (
    <section className="animate-rise rounded-2xl border border-white/10 bg-ink-900/50 overflow-hidden">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-medium text-mist-100">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-xs text-mist-200/60">
            <tr>
              <th className="px-3 py-2 text-right font-medium">الرمز</th>
              <th className="px-3 py-2 text-right font-medium">السعر</th>
              <th className="px-3 py-2 text-right font-medium">التغير</th>
              <th className="px-3 py-2 text-right font-medium">الحجم</th>
              <th className="px-3 py-2 text-right font-medium">اكتمال</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-mist-200/50">
                  لا توجد بيانات بعد — شغّل مسحاً أولاً
                </td>
              </tr>
            ) : (
              items.map((item) => <SymbolRow key={item.id} item={item} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const load = () => {
    startTransition(async () => {
      try {
        setError(null);
        const summary = await api.dashboard();
        setData(summary);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل اللوحة");
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const runScan = () => {
    startTransition(async () => {
      try {
        setScanMsg("جاري المسح...");
        await api.runScan({ fetch_history: false });
        setScanMsg("اكتمل المسح");
        const summary = await api.dashboard();
        setData(summary);
      } catch (e) {
        setScanMsg(e instanceof Error ? e.message : "فشل المسح");
      }
    });
  };

  const providerTone =
    data?.provider.status === "ok" ? "up" : data?.provider.status === "error" ? "down" : "warn";

  return (
    <div className="space-y-8">
      <section className="animate-rise relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-bl from-accent/20 via-ink-900/40 to-transparent px-6 py-10 sm:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative max-w-2xl">
          <p className="font-display text-4xl text-white sm:text-5xl">Atlas Markets</p>
          <h1 className="mt-3 text-xl text-mist-100 sm:text-2xl">
            مركز مراقبة الأسهم — المرحلة الأولى
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-mist-200/80">
            جمع بيانات موثوق، قوائم مراقبة متعددة، ومسح آلي. الحقول غير المتاحة تُعرض فارغة
            وليست صفراً، مع إظهار اكتمال البيانات وحداثتها.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={runScan}
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              مسح يدوي الآن
            </button>
            <button
              onClick={load}
              disabled={pending}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-mist-100 transition hover:bg-white/5"
            >
              تحديث اللوحة
            </button>
            {scanMsg && <span className="text-xs text-mist-200/80">{scanMsg}</span>}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-signal-down/40 bg-signal-down/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="قوائم المراقبة" value={String(data?.watchlist_count ?? "—")} />
        <StatPill label="الأسهم المتتبعة" value={String(data?.stock_count ?? "—")} />
        <StatPill
          label="حالة المزود"
          value={data ? `${data.provider.provider} · ${data.provider.status}` : "—"}
          tone={providerTone}
        />
        <StatPill
          label="آخر مسح"
          value={
            data?.last_scan_at
              ? new Date(data.last_scan_at).toLocaleString("ar")
              : "لا يوجد بعد"
          }
        />
      </section>

      {data?.provider.is_delayed && (
        <p className="animate-pulseSoft text-xs text-signal-wait">
          تنبيه: بيانات yfinance متأخرة بطبيعتها — لا تُعرض على أنها لحظية.
          {data.provider.completeness != null &&
            ` اكتمال عينة AAPL: ${Math.round(data.provider.completeness * 100)}%.`}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <MiniTable title="أفضل صعود (من القائمة الافتراضية)" items={data?.top_gainers || []} />
        <MiniTable title="أقوى هبوط" items={data?.top_losers || []} />
        <MiniTable title="حجم مرتفع مقابل المتوسط" items={data?.high_volume || []} />
      </div>
    </div>
  );
}
