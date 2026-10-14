export function formatDuration(ms?: number): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function countLines(s: string): number {
  if (!s) return 0;
  return s.split("\n").length;
}
