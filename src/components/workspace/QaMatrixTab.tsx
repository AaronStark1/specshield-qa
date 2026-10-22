import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { clsx } from "clsx";
import { ChevronsDownUp, ChevronsUpDown, Download, RotateCcw, Search, Table2, X } from "lucide-react";
import type { Priority, TestCase, TestCategory } from "@shared/types.js";
import { downloadText, safeFilename, toCsv, toMarkdownTable } from "../../lib/download.ts";
import { CATEGORIES, PRIORITIES, categoryCounts, priorityCounts, priorityTone } from "../../lib/runs.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { Button } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { Tab, Tabs } from "../ui/Tabs.tsx";
import { TEST_CASE_ROW_COLUMNS, TestCaseRow } from "./TestCaseRow.tsx";

type CategoryFilter = "All" | TestCategory;
type PriorityFilter = "All" | Priority;

export interface QaMatrixTabProps {
  cases: TestCase[];
  /** Run title, used in export filenames ("qa-matrix-<title>-<category>-<priority>.csv"). */
  runTitle?: string;
}

const EXPORT_HEADERS = ["ID", "Category", "Priority", "Title", "Given", "When", "Then", "Expected", "Feature", "Tags"];

function exportRows(cases: TestCase[]): string[][] {
  return cases.map((c) => [c.id, c.category, c.priority, c.title, c.given, c.when, c.then, c.expectedResult, c.featureId, c.tags.join("; ")]);
}

/** Lower-cased search haystack: every term of the query must appear somewhere in it. */
function haystack(c: TestCase): string {
  return [c.id, c.title, c.given, c.when, c.then, c.expectedResult, c.featureId, ...c.tags].join("\n").toLowerCase();
}

const CHIP_TONES: Record<"emerald" | "red" | "amber" | "sky" | "gray", string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  gray: "border-white/20 bg-white/[0.06] text-fg",
};

function PriorityChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: keyof typeof CHIP_TONES;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={`${label === "All" ? "All priorities" : label} · ${count}`}
      className={clsx(
        "inline-flex h-6 select-none items-center gap-1 rounded-md border px-1.5 font-mono text-[10.5px] font-medium uppercase tracking-wider transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        active ? CHIP_TONES[tone] : "border-edge text-fg-dim hover:border-edge-strong hover:text-fg-muted",
        !active && count === 0 && "opacity-50"
      )}
    >
      {label}
      <span className={clsx("tabular", active ? "opacity-90" : "text-fg-faint")}>{count}</span>
    </button>
  );
}

const NOTICE_MS = 2500;
const EMPTY_SET: ReadonlySet<string> = new Set();

export function QaMatrixTab({ cases, runTitle }: QaMatrixTabProps) {
  const [cat, setCat] = useState<CategoryFilter>("All");
  const [prio, setPrio] = useState<PriorityFilter>("All");
  const [q, setQ] = useState("");
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "fail" } | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const escapeTick = usePipelineStore((s) => s.escapeTick);

  // A global Esc (outside text fields) collapses every expanded row.
  const seenTick = useRef(escapeTick);
  useEffect(() => {
    if (seenTick.current === escapeTick) return;
    seenTick.current = escapeTick;
    setOpenIds(EMPTY_SET);
  }, [escapeTick]);

  // A new dataset starts collapsed (ids such as FIT-FUNC-001 repeat across runs).
  useEffect(() => {
    setOpenIds(EMPTY_SET);
  }, [cases]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const flash = (text: string, tone: "ok" | "fail") => {
    setNotice({ text, tone });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  };

  const indexed = useMemo(() => cases.map((tc) => ({ tc, hay: haystack(tc) })), [cases]);
  const terms = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const searched = useMemo(
    () => (terms.length === 0 ? cases : indexed.filter(({ hay }) => terms.every((t) => hay.includes(t))).map((x) => x.tc)),
    [cases, indexed, terms]
  );
  // Category counts reflect search + priority (not category); priority counts reflect search + category.
  const catCounts = useMemo(() => {
    const base = prio === "All" ? searched : searched.filter((c) => c.priority === prio);
    return { All: base.length, ...categoryCounts(base) };
  }, [searched, prio]);
  const prioCounts = useMemo(() => {
    const base = cat === "All" ? searched : searched.filter((c) => c.category === cat);
    return { All: base.length, ...priorityCounts(base) };
  }, [searched, cat]);
  const filtered = useMemo(
    () => searched.filter((c) => (cat === "All" || c.category === cat) && (prio === "All" || c.priority === prio)),
    [searched, cat, prio]
  );

  const filterActive = cat !== "All" || prio !== "All" || q !== "";
  const allOpen = filtered.length > 0 && filtered.every((c) => openIds.has(c.id));

  const resetFilters = () => {
    setCat("All");
    setPrio("All");
    setQ("");
  };

  const toggleRow = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setOpenIds(allOpen ? EMPTY_SET : new Set(filtered.map((c) => c.id)));

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && q !== "") {
      e.stopPropagation();
      setQ("");
    }
    // Empty query: let Esc propagate so the global handler blurs the field.
  };

  const exportAs = (kind: "csv" | "md") => {
    const rows = exportRows(filtered);
    const name = safeFilename(["qa-matrix", runTitle, cat !== "All" ? cat : undefined, prio !== "All" ? prio : undefined], kind);
    const ok =
      kind === "csv"
        ? downloadText(name, toCsv([EXPORT_HEADERS, ...rows]), "text/csv")
        : downloadText(name, toMarkdownTable(EXPORT_HEADERS, rows), "text/markdown");
    flash(ok ? `Saved ${name}` : "Download failed", ok ? "ok" : "fail");
  };

  if (cases.length === 0) {
    return (
      <EmptyState
        icon={<Table2 size={16} aria-hidden />}
        title="No test matrix yet"
        hint="Load the sample spec and run the pipeline. The QA Matrix Architect emits Functional, Boundary, Negative and Security cases here."
      />
    );
  }

  const exportCaption = filterActive ? `exports the ${filtered.length} filtered cases` : `exports all ${cases.length} cases`;

  return (
    <div className="min-w-0">
      {/* Toolbar row 1: category + priority filters */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Tabs label="Filter by category">
          {(["All", ...CATEGORIES] as CategoryFilter[]).map((c) => (
            <Tab key={c} active={cat === c} onClick={() => setCat(c)} count={catCounts[c]} controls="qa-matrix-results">
              {c}
            </Tab>
          ))}
        </Tabs>
        <div role="group" aria-label="Filter by priority" className="flex flex-wrap items-center gap-1">
          {(["All", ...PRIORITIES] as PriorityFilter[]).map((p) => (
            <PriorityChip
              key={p}
              label={p}
              count={prioCounts[p]}
              active={prio === p}
              tone={p === "All" ? "emerald" : priorityTone(p)}
              onClick={() => setPrio(p)}
            />
          ))}
        </div>
      </div>

      {/* Toolbar row 2: search, result count, row controls, exports */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-md flex-1 basis-56">
          <Search size={13} aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-dim" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search id, title, given/when/then, tags…"
            aria-label="Search test cases"
            autoComplete="off"
            spellCheck={false}
            className="field h-7 py-0 pl-7 pr-7 text-xs"
          />
          {q !== "" && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-dim transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>
        <span className="tabular font-mono text-2xs text-fg-dim">
          <span className={clsx(filtered.length === 0 ? "text-amber-300" : "text-fg-muted")}>{filtered.length}</span> of {cases.length}
        </span>
        {filterActive && (
          <Button variant="ghost" size="sm" icon={<RotateCcw size={13} aria-hidden />} onClick={resetFilters}>
            Reset filters
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={allOpen ? <ChevronsDownUp size={13} aria-hidden /> : <ChevronsUpDown size={13} aria-hidden />}
            onClick={toggleAll}
            disabled={filtered.length === 0}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-edge-strong" />
          <span className="font-mono text-2xs text-fg-dim">{exportCaption}</span>
          <Button variant="secondary" size="sm" icon={<Download size={13} aria-hidden />} onClick={() => exportAs("md")} disabled={filtered.length === 0}>
            Markdown
          </Button>
          <Button variant="secondary" size="sm" icon={<Download size={13} aria-hidden />} onClick={() => exportAs("csv")} disabled={filtered.length === 0}>
            CSV
          </Button>
        </div>
      </div>

      <div id="qa-matrix-results" className="min-w-0">
        {filtered.length === 0 ? (
          <EmptyState
            compact
            title="No cases match"
            hint="Try another category, priority or search term."
            action={
              <Button variant="secondary" size="sm" icon={<RotateCcw size={13} aria-hidden />} onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="max-h-[62vh] overflow-auto rounded-panel border border-edge bg-black/20">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
                <tr>
                  {["ID", "Category", "Priority", "Title", "Feature"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 py-2 font-mono text-2xs font-medium uppercase tracking-wider text-fg-dim shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
                    >
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="w-8 px-2 py-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tc) => (
                  <TestCaseRow key={tc.id} tc={tc} open={openIds.has(tc.id)} onToggle={() => toggleRow(tc.id)} colSpan={TEST_CASE_ROW_COLUMNS} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-2 flex min-h-[14px] flex-wrap items-center gap-x-3 font-mono text-2xs text-fg-dim">
        <span className="tabular">
          {filtered.length} of {cases.length} shown
          {openIds.size > 0 && ` · ${filtered.filter((c) => openIds.has(c.id)).length} expanded`}
        </span>
        <span role="status" aria-live="polite" className={clsx(notice?.tone === "fail" ? "text-red-300" : "text-emerald-300")}>
          {notice?.text}
        </span>
      </p>
    </div>
  );
}
