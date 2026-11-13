"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@elite.sa");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تسجيل الدخول");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <div className="font-display text-4xl font-bold tracking-tight text-white">Smart ERP</div>
          <p className="mt-3 text-slate-400">نظام الإدارة المالية والمحاسبية والموارد البشرية الذكي</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur">
          <h1 className="mb-6 text-xl font-bold text-navy">تسجيل الدخول</h1>
          {error && (
            <div className="mb-4">
              <Alert type="error">{error}</Alert>
            </div>
          )}
          <label className="label">البريد الإلكتروني</label>
          <input className="input mb-4" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="label">كلمة المرور</label>
          <input
            className="input mb-6"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
          <p className="mt-4 text-center text-xs text-slate-500">
            تجريبي: admin@elite.sa / Admin@123
          </p>
        </form>
      </div>
    </div>
  );
}
