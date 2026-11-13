"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, StatusBadge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";

type Supplier = { id: string; code: string; name: string };
type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  status: string;
  total: number;
  supplier: Supplier;
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

export function PurchasesClient({
  invoices,
  suppliers,
}: {
  invoices: Invoice[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("مشتريات");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("1000");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          invoiceDate,
          lines: [
            {
              description,
              quantity: Number(quantity),
              unitPrice: Number(unitPrice),
              taxRate: 15,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء فاتورة المشتريات");
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
        {open ? "إغلاق" : "فاتورة مشتريات جديدة"}
      </button>
      {error && <Alert type="error">{error}</Alert>}

      {open && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold text-navy">إنشاء فاتورة مشتريات</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">المورد</label>
              <select className="input" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">تاريخ الفاتورة</label>
              <input type="date" className="input" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
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
              <th>المورد</th>
              <th>البنود</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
                  لا توجد فواتير مشتريات
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono font-semibold">{inv.invoiceNumber}</td>
                  <td>{formatDate(inv.invoiceDate)}</td>
                  <td>{inv.supplier.name}</td>
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
