import { useMemo } from "react";
import type { RunRecord } from "@shared/types.js";

export function RunDiff({ a, b, onClose }: { a: RunRecord; b: RunRecord; onClose: () => void }) {
  const stats = useMemo(() => {
    const count = (r: RunRecord) => {
      const m: Record<string, number> = {};
      for (const t of r.testCases) m[t.category] = (m[t.category] ?? 0) + 1;
      return m;
    };
    const ca = count(a);
    const cb = count(b);
    const idsA = new Set(a.testCases.map((t) => t.id));
    const idsB = new Set(b.testCases.map((t) => t.id));
    const added = a.testCases.filter((t) => !idsB.has(t.id)).map((t) => t.id);
    const removed = b.testCases.filter((t) => !idsA.has(t.id)).map((t) => t.id);
    return { ca, cb, added, removed };
  }, [a, b]);

  const cats = ["Functional", "Boundary", "Negative", "Security"];
  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
      <div className="flex items-center gap-2">
        <strong>Compare with previous</strong>
        <span className="font-mono text-[#9ca3af]">{b.title} → {a.title}</span>
        <button onClick={onClose} className="ml-auto text-[#9ca3af] hover:text-white">Close</button>
      </div>
      <table className="mt-2 w-full text-left">
        <thead className="text-[#9ca3af]"><tr><th>Category</th><th>Current</th><th>Previous</th><th>Δ</th></tr></thead>
        <tbody className="font-mono">
          {cats.map((c) => (
            <tr key={c} className="border-t border-[#1f2937]">
              <td className="py-1">{c}</td>
              <td>{stats.ca[c] ?? 0}</td>
              <td>{stats.cb[c] ?? 0}</td>
              <td>{(stats.ca[c] ?? 0) - (stats.cb[c] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[11px]">Added: {stats.added.slice(0, 12).join(", ") || "—"}</p>
      <p className="mt-1 font-mono text-[11px]">Removed: {stats.removed.slice(0, 12).join(", ") || "—"}</p>
      <p className="mt-1 text-[#9ca3af]">Δ hours: {(a.roi.estimatedManualHours - b.roi.estimatedManualHours).toFixed(1)}h · Δ value: ${(a.roi.billableValueUsd - b.roi.billableValueUsd).toFixed(2)}</p>
    </div>
  );
}
