/** Trigger a browser download. Returns false if the Blob/anchor path is unavailable. */
export function downloadText(filename: string, content: string, mime = "text/plain"): boolean {
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

/** RFC 4180 CSV: every field quoted, embedded quotes doubled, CRLF row endings (newlines inside fields are preserved). */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
}

function mdCell(s: string): string {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

export function toMarkdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(mdCell).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(mdCell).join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n`;
}

/** "qa-matrix-invoice-tracker-security.csv" — lowercase, dash-separated, safe for every OS. */
export function safeFilename(parts: (string | undefined | null)[], ext: string): string {
  const base = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("-")
    .slice(0, 80);
  return `${base || "export"}.${ext.replace(/^\./, "")}`;
}
