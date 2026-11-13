"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, StatusBadge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";

type Customer = { id: string; code: string; name: string };
type Product = { id: string; code: string; name: string; unitPrice: number; taxRate: number };
type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  customer: Customer;
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

export function SalesClient({
  invoices,
  customers,
  products,
}: {
  invoices: Invoice[];
  customers: Customer[];
  products: Product[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(String(products[0]?.unitPrice ?? 0));
  const [description, setDescription] = useState(products[0]?.name || "خدمة");

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setUnitPrice(String(p.unitPrice));
      setDescription(p.name);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const product = products.find((p) => p.id === productId);
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          invoiceDate,
          lines: [
            {
              productId: productId || null,
              description,
              quantity: Number(quantity),
              unitPrice: Number(unitPrice),
              taxRate: product?.taxRate ?? 15,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الفاتورة");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" className="btn-primary" onClick={() => setOpen((v) => !v)}>
        {open ? "إغلاق" : "فاتورة مبيعات جديدة"}
      </button>
      {error && <Alert type="error">{error}</Alert>}

      {open && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold text-navy">إنشاء فاتورة مبيعات</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">العميل</label>
              <select className="input" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">تاريخ الفاتورة</label>
              <input type="date" className="input" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className="label">المنتج / الخدمة</label>
              <select className="input" value={productId} onChange={(e) => onProductChange(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">الوصف</label>
              <input className="input" required value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="label">الكمية</label>
              <input type="number" min="0.01" step="0.01" className="input" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <label className="label">سعر الوحدة</label>
              <input type="number" min="0" step="0.01" className="input" required value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
          </button>
        </form>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>التاريخ</th>
              <th>العميل</th>
              <th>البنود</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
                  لا توجد فواتير مبيعات
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono font-semibold">{inv.invoiceNumber}</td>
                  <td>{formatDate(inv.invoiceDate)}</td>
                  <td>{inv.customer.name}</td>
                  <td>
                    {inv.lines.map((l) => (
                      <div key={l.id} className="text-xs text-slate-500">
                        {l.description} × {l.quantity}
                      </div>
                    ))}
                  </td>
                  <td className="font-semibold">{formatMoney(inv.total)}</td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
