"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, Alert, Kpi } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    unitPrice: "",
    costPrice: "",
    stockQty: "",
  });
  const [receive, setReceive] = useState({ productId: "", quantity: "", unitCost: "" });

  async function load() {
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_warehouse" }),
    });
    const data = await (await fetch("/api/inventory")).json();
    setProducts(data.products || []);
    setMovements(data.movements || []);
    if (!receive.productId && data.products?.[0]) {
      setReceive((r) => ({ ...r, productId: data.products[0].id }));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProduct(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_product",
        ...form,
        unitPrice: Number(form.unitPrice),
        costPrice: Number(form.costPrice),
        stockQty: Number(form.stockQty || 0),
        trackInventory: true,
        type: "PRODUCT",
      }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setMsg("تم إضافة الصنف");
      setForm({ code: "", name: "", unitPrice: "", costPrice: "", stockQty: "" });
      load();
    }
  }

  async function receiveStock(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "receive",
        productId: receive.productId,
        quantity: Number(receive.quantity),
        unitCost: Number(receive.unitCost),
      }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setMsg(`تم التوريد — متوسط التكلفة الجديد ${data.newAvg}`);
      load();
    }
  }

  const low = products.filter((p) => p.trackInventory && p.stockQty <= (p.reorderLevel || 0));
  const stockValue = products.reduce((s, p) => s + (p.stockQty || 0) * (p.costPrice || 0), 0);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="المخازن والأصناف"
        subtitle="تكلفة المتوسط المرجح (WAC) · حركات المخزون · تنبيهات إعادة الطلب"
      />
      {msg && <Alert type="info">{msg}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="عدد الأصناف" value={String(products.length)} />
        <Kpi label="قيمة المخزون (بالتكلفة)" value={formatMoney(stockValue)} tone="blue" />
        <Kpi label="أصناف تحت حد الطلب" value={String(low.length)} tone="orange" />
      </div>

      <form onSubmit={createProduct} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-5">
        <input className="input" placeholder="الرمز" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="input" placeholder="الاسم" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" type="number" placeholder="سعر البيع" required value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
        <input className="input" type="number" placeholder="تكلفة أولية" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
        <button className="btn-primary">إضافة صنف</button>
      </form>

      <form onSubmit={receiveStock} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
        <select className="input" value={receive.productId} onChange={(e) => setReceive({ ...receive, productId: e.target.value })}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <input className="input" type="number" placeholder="الكمية الواردة" required value={receive.quantity} onChange={(e) => setReceive({ ...receive, quantity: e.target.value })} />
        <input className="input" type="number" placeholder="تكلفة الوحدة" required value={receive.unitCost} onChange={(e) => setReceive({ ...receive, unitCost: e.target.value })} />
        <button className="btn-secondary">توريد مخزون (WAC)</button>
      </form>

      <div className="table-wrap">
        <table className="data-table tabular-nums">
          <thead>
            <tr>
              <th>الرمز</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>متوسط التكلفة</th>
              <th>سعر البيع</th>
              <th>القيمة</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.code}</td>
                <td>{p.name}</td>
                <td>{p.stockQty}</td>
                <td>{formatMoney(p.costPrice)}</td>
                <td>{formatMoney(p.unitPrice)}</td>
                <td>{formatMoney((p.stockQty || 0) * (p.costPrice || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الحركة</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>التكلفة</th>
              <th>المرجع</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{m.movementType}</td>
                <td>{m.product?.name}</td>
                <td>{m.quantity}</td>
                <td>{formatMoney(m.totalCost)}</td>
                <td className="text-xs text-slate-500">
                  {m.referenceType || "—"} {m.notes || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
