"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, Kpi } from "@/components/ui";
import { formatMoney, round2 } from "@/lib/utils";
import { openDB } from "idb";

type Product = {
  id: string;
  code: string;
  name: string;
  unitPrice: number;
  taxRate: number;
  stockQty: number;
  trackInventory: boolean;
};

type CartLine = { productId: string; name: string; quantity: number; unitPrice: number; taxRate: number };

async function getOfflineDb() {
  return openDB("smart-erp-pos", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", { keyPath: "id", autoIncrement: true });
      }
    },
  });
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [msg, setMsg] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);

  async function refreshPending() {
    const db = await getOfflineDb();
    setPendingCount((await db.getAll("pendingSales")).length);
  }

  async function load() {
    const data = await (await fetch("/api/inventory")).json();
    setProducts((data.products || []).filter((p: Product) => p.unitPrice > 0));
  }

  useEffect(() => {
    void load();
    void refreshPending();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const totals = useMemo(() => {
    const subtotal = round2(cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const tax = round2(cart.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxRate / 100), 0));
    return { subtotal, tax, total: round2(subtotal + tax) };
  }, [cart]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const found = prev.find((l) => l.productId === p.id);
      if (found) {
        return prev.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          quantity: 1,
          unitPrice: p.unitPrice,
          taxRate: p.taxRate || 15,
        },
      ];
    });
  }

  async function checkout() {
    if (!cart.length) return;
    const payload = {
      lines: cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      offlineAt: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      const db = await getOfflineDb();
      await db.add("pendingSales", payload);
      setCart([]);
      setMsg("تم حفظ البيع محلياً — ستتم المزامنة عند عودة الإنترنت");
      refreshPending();
      return;
    }

    const res = await fetch("/api/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "فشل البيع");
      return;
    }
    setCart([]);
    setMsg(`تم إصدار وترحيل ${data.invoiceNumber} · الإجمالي ${formatMoney(data.total)}`);
    load();
  }

  async function syncPending() {
    const db = await getOfflineDb();
    const rows = await db.getAll("pendingSales");
    for (const row of rows) {
      const { id, ...payload } = row as { id: number } & Record<string, unknown>;
      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) await db.delete("pendingSales", id);
    }
    refreshPending();
    setMsg("تمت مزامنة المبيعات المحلية");
    load();
  }

  return (
    <div className="animate-fade-up space-y-4">
      <PageHeader
        title="نقطة البيع POS"
        subtitle="Local-First عبر IndexedDB — يعمل دون إنترنت ثم يزامن الفواتير"
        actions={
          <>
            <span className={online ? "badge-green" : "badge-red"}>{online ? "متصل" : "غير متصل"}</span>
            {pendingCount > 0 && (
              <button className="btn-secondary" onClick={syncPending}>
                مزامنة ({pendingCount})
              </button>
            )}
          </>
        }
      />
      {msg && <Alert type="info">{msg}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="font-semibold text-navy">{p.name}</div>
                <div className="mt-1 text-xs text-slate-400">{p.code}</div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-sky-700">{formatMoney(p.unitPrice)}</span>
                  <span className="text-slate-400">مخزون {p.stockQty}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">السلة</h3>
          <div className="space-y-2">
            {cart.map((l) => (
              <div key={l.productId} className="flex items-center justify-between text-sm">
                <div>
                  <div>{l.name}</div>
                  <div className="text-xs text-slate-400">
                    {l.quantity} × {formatMoney(l.unitPrice)}
                  </div>
                </div>
                <button className="text-xs text-red-500" onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))}>
                  حذف
                </button>
              </div>
            ))}
            {cart.length === 0 && <div className="text-sm text-slate-400">السلة فارغة</div>}
          </div>
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm tabular-nums">
            <div className="flex justify-between">
              <span>المجموع</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>الضريبة</span>
              <span>{formatMoney(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>الإجمالي</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>
          <button className="btn-primary mt-4 w-full" disabled={!cart.length} onClick={checkout}>
            إتمام البيع وترحيل القيد
          </button>
          <div className="mt-3">
            <Kpi label="مبيعات معلّقة محلياً" value={String(pendingCount)} tone="orange" />
          </div>
        </div>
      </div>
    </div>
  );
}
