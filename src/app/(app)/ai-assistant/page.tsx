"use client";

import { useState } from "react";
import { PageHeader, Alert } from "@/components/ui";

type Source = { type: string; detail: string };
type Reply = {
  answer: string;
  period: { label: string; year: number; month: number };
  sources: Source[];
  disclaimer: string;
};

const SUGGESTIONS = [
  "ما هي أرباح نوفمبر 2026؟",
  "كم إجمالي المصروفات هذا الشهر؟",
  "أخبرني عن الرواتب",
  "أداء الفروع",
  "ما وضع السيولة والنقد؟",
  "كم عدد الموظفين النشطين؟",
];

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (!text) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "تعذر الإجابة");
      return;
    }
    setReply(data);
    setHistory((h) => [{ q: text, a: data.answer }, ...h].slice(0, 8));
    setQuestion("");
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="المساعد المالي الذكي"
        subtitle="إجابات عربية مبنية على بيانات حقيقية من النظام — قراءة فقط بدون تعديل"
      />

      {error && (
        <div className="mb-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="mb-6 flex gap-2">
        <input
          className="input flex-1"
          placeholder="اسأل عن الأرباح، المصروفات، الرواتب، الفروع..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button className="btn-primary" disabled={loading} onClick={() => ask()}>
          {loading ? "جاري التحليل..." : "اسأل"}
        </button>
      </div>

      {reply && (
        <div className="mb-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">
            الفترة: {reply.period.label} · محرك قواعد NLP · قراءة فقط
          </div>
          <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{reply.answer}</p>
          <div>
            <div className="mb-1 text-sm font-semibold text-navy">المصادر</div>
            <ul className="space-y-1 text-xs text-slate-600">
              {reply.sources.map((s, i) => (
                <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-sky-700">{s.type}</span> — {s.detail}
                </li>
              ))}
            </ul>
          </div>
          <Alert type="info">{reply.disclaimer}</Alert>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-navy">سجل الأسئلة</h2>
          {history.map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 text-sm">
              <div className="font-medium text-sky-800">س: {h.q}</div>
              <div className="mt-2 whitespace-pre-wrap text-slate-600">ج: {h.a}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
