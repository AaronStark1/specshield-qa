export function formatDuration(ms?: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Seconds with one decimal, for live elapsed counters ("12.3s"). */
export function formatSeconds(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokens(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

export function formatNumber(n?: number | null, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** "just now", "4 min ago", "3 h ago", "2 d ago" */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, now - t);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function formatUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Uses 4 decimals for tiny non-zero amounts so cloud-cost estimates don't round to $0.00. */
export function formatUsdSmart(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 0.01) return formatUsd(n, 4);
  return formatUsd(n, 2);
}

export function formatHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  return `${h.toFixed(1)} hrs`;
}

export function formatPercent(part: number, total: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

export function countLines(s: string): number {
  if (!s) return 0;
  return s.split("\n").length;
}

/** Heuristic used across the app (and by the API when Ollama reports no usage): ~4 characters per token. */
export const CHARS_PER_TOKEN = 4;
export function estimateTokens(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.round(chars / CHARS_PER_TOKEN);
}

export function slugify(s: string, fallback = "run"): string {
  const out = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return out || fallback;
}

/** Parse a numeric input safely; falls back when NaN or out of range. */
export function clampNumber(raw: string | number, min: number, max: number, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
