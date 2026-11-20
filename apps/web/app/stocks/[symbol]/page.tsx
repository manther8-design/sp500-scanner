"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { StatPill } from "@/components/StatPill";
import { api, fmtNum, fmtPct, fmtVol, Quote } from "@/lib/api";

export default function StockPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol || "").toUpperCase();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      try {
        setError(null);
        const q = await api.quote(symbol);
        setQuote(q);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر جلب السعر");
      }
    });
  };

  useEffect(() => {
    if (symbol) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const changeTone =
    quote?.change_percent == null
      ? "neutral"
      : quote.change_percent > 0
        ? "up"
        : quote.change_percent < 0
          ? "down"
          : "neutral";

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <Link href="/watchlists" className="text-sm text-mist-200/70 hover:text-white">
          ← العودة للقوائم
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-white">{symbol}</h1>
            <p className="mt-1 text-mist-200/80">{quote?.name || "جاري التحميل..."}</p>
            {quote?.sector && (
              <p className="mt-1 text-xs text-mist-200/60">{quote.sector}</p>
            )}
          </div>
          <button
            onClick={load}
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            تحديث السعر
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-signal-down/40 bg-signal-down/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="السعر الحالي" value={fmtNum(quote?.price)} tone={changeTone} />
        <StatPill label="التغير اليومي" value={fmtPct(quote?.change_percent)} tone={changeTone} />
        <StatPill label="الحجم" value={fmtVol(quote?.volume)} />
        <StatPill label="متوسط الحجم" value={fmtVol(quote?.avg_volume)} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="الافتتاح" value={fmtNum(quote?.open)} />
        <StatPill label="الأعلى" value={fmtNum(quote?.high)} />
        <StatPill label="الأدنى" value={fmtNum(quote?.low)} />
        <StatPill label="الإغلاق السابق" value={fmtNum(quote?.previous_close)} />
      </section>

      <section className="animate-rise rounded-2xl border border-white/10 bg-ink-900/50 p-5">
        <h2 className="text-sm font-medium text-mist-100">جودة البيانات</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-mist-200/60">المصدر</dt>
            <dd className="mt-1">{quote?.meta?.source || "—"}</dd>
          </div>
          <div>
            <dt className="text-mist-200/60">وقت البيانات (as_of)</dt>
            <dd className="mt-1">
              {quote?.meta?.as_of ? new Date(quote.meta.as_of).toLocaleString("ar") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-mist-200/60">وقت الاستلام</dt>
            <dd className="mt-1">
              {quote?.meta?.ingested_at
                ? new Date(quote.meta.ingested_at).toLocaleString("ar")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-mist-200/60">التأخير / الاكتمال</dt>
            <dd className="mt-1">
              {quote?.meta?.is_delayed ? "متأخر" : "لحظي"} ·{" "}
              {quote?.meta?.completeness != null
                ? `${Math.round(quote.meta.completeness * 100)}%`
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-mist-200/60">حقول غير متاحة (لا تُختلق)</dt>
            <dd className="mt-1 text-mist-100">
              {(quote?.meta?.unavailable_fields || []).length
                ? quote?.meta?.unavailable_fields?.join(" · ")
                : "لا يوجد"}
            </dd>
          </div>
          <div>
            <dt className="text-mist-200/60">VWAP</dt>
            <dd className="mt-1 tabular-nums">{fmtNum(quote?.vwap)}</dd>
          </div>
          <div>
            <dt className="text-mist-200/60">Bid / Ask / Spread</dt>
            <dd className="mt-1 tabular-nums">
              {fmtNum(quote?.bid)} / {fmtNum(quote?.ask)} / {fmtNum(quote?.spread)}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-xs leading-6 text-mist-200/60">
          التحليل الفني وSMC ومناطق الدخول والتقييم الموحد ستُضاف في المراحل اللاحقة. هذه
          الصفحة تعرض البيانات الأساسية وحالة اكتمالها فقط.
        </p>
      </section>
    </div>
  );
}
