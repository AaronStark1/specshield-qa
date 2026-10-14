import { useMemo, useState } from "react";
import type { TestCase, TestCategory } from "@shared/types.js";
import { downloadText, toCsv, toMarkdownTable } from "../../lib/download.ts";
import { Badge } from "../ui/Badge.tsx";
import { GhostButton } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { TestCaseRow } from "./TestCaseRow.tsx";

const CATS: ("All" | TestCategory)[] = ["All", "Functional", "Boundary", "Negative", "Security"];

function toneFor(cat: TestCategory): string {
  return cat === "Functional" ? "emerald" : cat === "Boundary" ? "amber" : cat === "Negative" ? "violet" : "sky";
}

export function QaMatrixTab({ cases }: { cases: TestCase[] }) {
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [prio, setPrio] = useState<string>("All");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: cases.length };
    for (const c of cases) m[c.category] = (m[c.category] ?? 0) + 1;
    return m;
  }, [cases]);

  const filtered = cases.filter((c) => {
    if (cat !== "All" && c.category !== cat) return false;
    if (prio !== "All" && c.priority !== prio) return false;
    if (q && !(c.title + c.id + c.given + c.when + c.then + c.expectedResult).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (cases.length === 0) {
    return <EmptyState title="No test matrix yet" hint="Load the sample spec and run the pipeline to generate 28+ cases." />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${cat === c ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-[#1f2937] bg-[#0b0f17] text-[#9ca3af]"}`}
          >
            {c} <span className="font-mono opacity-70">{counts[c] ?? 0}</span>
          </button>
        ))}
        <select value={prio} onChange={(e) => setPrio(e.target.value)} className="rounded-lg border border-[#1f2937] bg-[#0b0f17] px-2 py-1 text-xs">
          {["All", "P0", "P1", "P2", "P3"].map((p) => <option key={p} value={p}>{p === "All" ? "All priorities" : p}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases…" className="min-w-[160px] flex-1 rounded-lg border border-[#1f2937] bg-[#0b0f17] px-2 py-1 text-xs" />
        <GhostButton
          onClick={() => {
            const rows = filtered.map((c) => [c.id, c.category, c.priority, c.title, c.given, c.when, c.then, c.expectedResult, c.featureId]);
            downloadText("qa-matrix.md", toMarkdownTable(["ID", "Category", "Priority", "Title", "Given", "When", "Then", "Expected", "Feature"], rows), "text/markdown");
          }}
        >Download .md</GhostButton>
        <GhostButton
          onClick={() => {
            const rows = [["id", "category", "priority", "title", "given", "when", "then", "expected", "feature"], ...filtered.map((c) => [c.id, c.category, c.priority, c.title, c.given, c.when, c.then, c.expectedResult, c.featureId])];
            downloadText("qa-matrix.csv", toCsv(rows), "text/csv");
          }}
        >Download .csv</GhostButton>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#1f2937]">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-black/30 text-[#9ca3af]">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Feature</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <TestCaseRow key={c.id} tc={c} badge={<Badge tone={toneFor(c.category)}>{c.category}</Badge>} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-mono text-[11px] text-[#9ca3af]">{filtered.length} of {cases.length} shown</p>
    </div>
  );
}
