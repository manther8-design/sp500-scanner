"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChangeCell } from "@/components/ChangeCell";
import { api, fmtNum, fmtVol, Watchlist } from "@/lib/api";

export default function WatchlistsPage() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [active, setActive] = useState<Watchlist | null>(null);
  const [symbol, setSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [intervalMin, setIntervalMin] = useState(60);

  const refreshLists = async () => {
    const data = await api.watchlists();
    setLists(data);
    const preferred = activeId ?? data.find((w) => w.is_default)?.id ?? data[0]?.id ?? null;
    if (preferred) {
      setActiveId(preferred);
      const full = await api.watchlist(preferred);
      setActive(full);
    }
  };

  useEffect(() => {
    startTransition(async () => {
      try {
        await refreshLists();
        const job = await api.scanJob();
        setIntervalMin(job.interval_minutes);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "خطأ في التحميل");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectList = (id: number) => {
    startTransition(async () => {
      setActiveId(id);
      const full = await api.watchlist(id);
      setActive(full);
    });
  };

  const createList = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      try {
        await api.createWatchlist({ name: newName.trim() });
        setNewName("");
        await refreshLists();
        setMessage("تم إنشاء القائمة");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "تعذر إنشاء القائمة");
      }
    });
  };

  const addSymbol = () => {
    if (!symbol.trim()) {
      setMessage("أدخل رمز السهم أولاً");
      return;
    }
    if (!activeId) {
      setMessage("لا توجد قائمة محددة. أنشئ قائمة أو انتظر تحميل القوائم بعد تشغيل الـ API.");
      return;
    }
    const ticker = symbol.trim().toUpperCase();
    startTransition(async () => {
      try {
        await api.addItem(activeId, ticker);
        setSymbol("");
        const full = await api.watchlist(activeId);
        setActive(full);
        setLists(await api.watchlists());
        setMessage(`تمت إضافة ${ticker}`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "تعذر إضافة السهم");
      }
    });
  };

  const removeItem = (itemId: number) => {
    if (!activeId) return;
    startTransition(async () => {
      await api.deleteItem(activeId, itemId);
      const full = await api.watchlist(activeId);
      setActive(full);
    });
  };

  const togglePin = (itemId: number, pinned: boolean) => {
    if (!activeId) return;
    startTransition(async () => {
      await api.pinItem(activeId, itemId, !pinned);
      const full = await api.watchlist(activeId);
      setActive(full);
    });
  };

  const onImport = (file: File | null) => {
    if (!file || !activeId) return;
    startTransition(async () => {
      const result = await api.importFile(activeId, file);
      const full = await api.watchlist(activeId);
      setActive(full);
      setMessage(`استيراد: ${result.added} مضاف / ${result.skipped} موجود مسبقاً`);
    });
  };

  const saveInterval = () => {
    startTransition(async () => {
      await api.updateScanJob(intervalMin, true);
      setMessage(`تم ضبط فترة المسح على ${intervalMin} دقيقة`);
    });
  };

  const runScan = () => {
    if (!activeId) return;
    startTransition(async () => {
      setMessage("جاري مسح القائمة...");
      await api.runScan({ watchlist_id: activeId, fetch_history: false });
      const full = await api.watchlist(activeId);
      setActive(full);
      setMessage("اكتمل مسح القائمة");
    });
  };

  return (
    <div className="space-y-6">
      <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">قوائم المراقبة</h1>
          <p className="mt-1 text-sm text-mist-200/70">
            إضافة وحذف وتثبيت واستيراد CSV/Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={5}
            max={1440}
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            className="w-24 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
          <button
            onClick={saveInterval}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
          >
            حفظ فترة المسح
          </button>
          <button
            onClick={runScan}
            disabled={pending || !activeId}
            className="rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            مسح القائمة
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-mist-100">
          {message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-3">
            <div className="mb-2 text-xs text-mist-200/60">القوائم</div>
            <ul className="space-y-1">
              {lists.map((wl) => (
                <li key={wl.id}>
                  <button
                    onClick={() => selectList(wl.id)}
                    className={`w-full rounded-lg px-3 py-2 text-right text-sm transition ${
                      activeId === wl.id ? "bg-accent/20 text-white" : "hover:bg-white/5 text-mist-100"
                    }`}
                  >
                    <div className="font-medium">{wl.name}</div>
                    <div className="text-xs text-mist-200/60">
                      {wl.item_count} سهم {wl.is_default ? "· افتراضي" : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم قائمة جديدة"
                className="flex-1 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm"
              />
              <button
                onClick={createList}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
              >
                +
              </button>
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="رمز السهم (AAPL)"
              className="rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addSymbol()}
            />
            <button
              onClick={addSymbol}
              disabled={pending}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              إضافة
            </button>
            <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5">
              استيراد CSV/Excel
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => onImport(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-xs text-mist-200/60">
                <tr>
                  <th className="px-3 py-2 text-right">تثبيت</th>
                  <th className="px-3 py-2 text-right">الرمز</th>
                  <th className="px-3 py-2 text-right">القطاع</th>
                  <th className="px-3 py-2 text-right">السعر</th>
                  <th className="px-3 py-2 text-right">التغير</th>
                  <th className="px-3 py-2 text-right">الحجم</th>
                  <th className="px-3 py-2 text-right">متوسط الحجم</th>
                  <th className="px-3 py-2 text-right">أعلى/أدنى</th>
                  <th className="px-3 py-2 text-right">اكتمال</th>
                  <th className="px-3 py-2 text-right">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {(active?.items || []).map((item) => (
                  <tr key={item.id} className="table-row-hover border-b border-white/5">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => togglePin(item.id, item.is_pinned)}
                        className={item.is_pinned ? "text-signal-wait" : "text-mist-200/40"}
                        title="تثبيت"
                      >
                        ★
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/stocks/${item.stock?.symbol}`}
                        className="font-semibold hover:text-accent"
                      >
                        {item.stock?.symbol}
                      </Link>
                      <div className="text-xs text-mist-200/50">{item.stock?.name}</div>
                    </td>
                    <td className="px-3 py-3 text-mist-200/80">{item.stock?.sector || "—"}</td>
                    <td className="px-3 py-3 tabular-nums">{fmtNum(item.quote?.price)}</td>
                    <td className="px-3 py-3">
                      <ChangeCell value={item.quote?.change_percent} />
                    </td>
                    <td className="px-3 py-3 tabular-nums">{fmtVol(item.quote?.volume)}</td>
                    <td className="px-3 py-3 tabular-nums">{fmtVol(item.quote?.avg_volume)}</td>
                    <td className="px-3 py-3 tabular-nums text-xs">
                      {fmtNum(item.quote?.high)} / {fmtNum(item.quote?.low)}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {item.quote?.completeness != null
                        ? `${Math.round(item.quote.completeness * 100)}%`
                        : "—"}
                      {item.quote?.is_delayed ? (
                        <span className="mr-1 text-signal-wait">متأخر</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-signal-down hover:underline"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                {!active?.items?.length && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-mist-200/50">
                      القائمة فارغة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
