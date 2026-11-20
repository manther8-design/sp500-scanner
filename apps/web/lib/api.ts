/**
 * Empty string = same-origin (recommended). Next.js rewrites proxy /api to the backend.
 * Set NEXT_PUBLIC_API_URL only if the browser must call the API host directly.
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function friendlyError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg === "Failed to fetch" ||
    msg.includes("NetworkError") ||
    msg.includes("fetch failed") ||
    msg.includes("ECONNREFUSED")
  ) {
    return new Error(
      "تعذر الاتصال بالخادم. تأكد أن الـ API يعمل على المنفذ 8000 (python -m uvicorn apps.api.app.main:app --port 8000)."
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      let detail = text || `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.detail) {
          detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        /* keep raw text */
      }
      throw new Error(detail);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err) {
    throw friendlyError(err);
  }
}

export type ProviderStatus = {
  provider: string;
  status: string;
  is_delayed: boolean;
  checked_at?: string | null;
  sample_price?: number | null;
  completeness?: number | null;
  error?: string | null;
};

export type QuoteBrief = {
  price?: number | null;
  change?: number | null;
  change_percent?: number | null;
  volume?: number | null;
  avg_volume?: number | null;
  high?: number | null;
  low?: number | null;
  as_of?: string | null;
  is_delayed?: boolean | null;
  completeness?: number | null;
  quality_flag?: string | null;
};

export type Stock = {
  id: number;
  symbol: string;
  name?: string | null;
  sector?: string | null;
  market_cap_class?: string | null;
  currency?: string | null;
};

export type WatchlistItem = {
  id: number;
  watchlist_id: number;
  stock_id: number;
  is_pinned: boolean;
  sort_order: number;
  status_label?: string | null;
  notes?: string | null;
  stock?: Stock | null;
  quote?: QuoteBrief | null;
};

export type Watchlist = {
  id: number;
  name: string;
  description?: string | null;
  is_default: boolean;
  item_count: number;
  items: WatchlistItem[];
};

export type DashboardSummary = {
  watchlist_count: number;
  stock_count: number;
  last_scan_at?: string | null;
  last_scan_status?: string | null;
  provider: ProviderStatus;
  top_gainers: WatchlistItem[];
  top_losers: WatchlistItem[];
  high_volume: WatchlistItem[];
  recent_alerts: Array<Record<string, unknown>>;
};

export type Quote = {
  symbol: string;
  price?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  previous_close?: number | null;
  change?: number | null;
  change_percent?: number | null;
  volume?: number | null;
  avg_volume?: number | null;
  vwap?: number | null;
  bid?: number | null;
  ask?: number | null;
  spread?: number | null;
  name?: string | null;
  sector?: string | null;
  meta?: {
    source: string;
    as_of?: string | null;
    ingested_at?: string | null;
    is_delayed: boolean;
    completeness?: number | null;
    quality_flag?: string | null;
    unavailable_fields?: string[];
  } | null;
};

export const api = {
  dashboard: () => request<DashboardSummary>("/api/dashboard/summary"),
  watchlists: () => request<Watchlist[]>("/api/watchlists"),
  watchlist: (id: number) => request<Watchlist>(`/api/watchlists/${id}`),
  createWatchlist: (body: { name: string; description?: string; is_default?: boolean }) =>
    request<Watchlist>("/api/watchlists", { method: "POST", body: JSON.stringify(body) }),
  addItem: (id: number, symbol: string) =>
    request<WatchlistItem>(`/api/watchlists/${id}/items`, {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  deleteItem: (watchlistId: number, itemId: number) =>
    request<void>(`/api/watchlists/${watchlistId}/items/${itemId}`, { method: "DELETE" }),
  pinItem: (watchlistId: number, itemId: number, is_pinned: boolean) =>
    request<WatchlistItem>(`/api/watchlists/${watchlistId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_pinned }),
    }),
  importFile: async (watchlistId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ parsed: number; added: number; skipped: number }>(
      `/api/watchlists/${watchlistId}/import`,
      { method: "POST", body: form, headers: {} }
    );
  },
  quote: (symbol: string) => request<Quote>(`/api/stocks/${symbol}/quote`),
  search: (q: string) =>
    request<Array<{ symbol: string; name?: string | null }>>(
      `/api/stocks/search?q=${encodeURIComponent(q)}`
    ),
  runScan: (body?: { watchlist_id?: number; symbols?: string[]; fetch_history?: boolean }) =>
    request("/api/scans/run-now", { method: "POST", body: JSON.stringify(body || {}) }),
  scanJob: () => request<{ interval_minutes: number; is_enabled: boolean }>("/api/scans/jobs/default"),
  updateScanJob: (interval_minutes: number, is_enabled?: boolean) =>
    request("/api/scans/jobs/default", {
      method: "PATCH",
      body: JSON.stringify({ interval_minutes, is_enabled }),
    }),
};

export function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function fmtVol(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}
