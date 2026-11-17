import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { clsx } from "clsx";
import { ChevronsDownUp, ChevronsUpDown, Download, RotateCcw, Search, Table2, X } from "lucide-react";
import type { Priority, TestCase, TestCategory } from "@shared/types.js";
import { downloadText, safeFilename, toCsv, toMarkdownTable } from "../../lib/download.ts";
import { CATEGORIES, PRIORITIES, categoryCounts, categoryTone, priorityCounts, priorityTone } from "../../lib/runs.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { Button } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { TEST_CASE_ROW_COLUMNS, TestCaseCard, TestCaseRow } from "./TestCaseRow.tsx";

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

const CHIP_TONES: Record<"emerald" | "red" | "amber" | "violet" | "cyan" | "sky" | "gray", string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  gray: "border-white/20 bg-white/[0.06] text-fg",
};

/** Toggle chip used by both filter groups; `tone` is the colour it takes when selected. */
function FilterChip({
  label,
  count,
  active,
  tone,
  onClick,
  mono,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: keyof typeof CHIP_TONES;
  onClick: () => void;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={`${label} · ${count}`}
      className={clsx(
        "inline-flex h-7 select-none items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        mono && "font-mono uppercase tracking-wider",
        active ? CHIP_TONES[tone] : "border-edge text-fg-muted hover:border-edge-strong hover:text-fg",
        !active && count === 0 && "opacity-50"
      )}
    >
      {label}
      <span className={clsx("tabular text-[11px]", active ? "opacity-90" : "text-fg-dim")}>{count}</span>
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
        hint="Load a sample spec and press Generate Test Suite. Functional, Boundary, Negative and Security cases appear here."
      />
    );
  }

  const exportCaption = filterActive ? `Export the ${filtered.length} filtered cases` : `Export all ${cases.length} cases`;

  return (
    <div className="min-w-0">
      {/* Search */}
      <div className="relative">
        <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search test cases…"
          aria-label="Search test cases"
          autoComplete="off"
          spellCheck={false}
          className="field h-9 pl-9 pr-9"
        />
        {q !== "" && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-dim transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <X size={13} aria-hidden />
          </button>
        )}
      </div>

      {/* Filters: category chips carry the same colours as the badges in the table */}
      <div className="mb-3 mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="Filter by category" className="flex flex-wrap items-center gap-1.5">
          {(["All", ...CATEGORIES] as CategoryFilter[]).map((c) => (
            <FilterChip
              key={c}
              label={c}
              count={catCounts[c]}
              active={cat === c}
              tone={c === "All" ? "gray" : categoryTone(c)}
              onClick={() => setCat(c)}
            />
          ))}
        </div>
        <div role="group" aria-label="Filter by priority" className="flex flex-wrap items-center gap-1.5">
          {PRIORITIES.map((p) => (
            <FilterChip key={p} label={p} count={prioCounts[p]} active={prio === p} tone={priorityTone(p)} onClick={() => setPrio(prio === p ? "All" : p)} mono />
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {filterActive && (
            <Button variant="ghost" size="sm" icon={<RotateCcw size={13} aria-hidden />} onClick={resetFilters}>
              Reset
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={allOpen ? <ChevronsDownUp size={13} aria-hidden /> : <ChevronsUpDown size={13} aria-hidden />}
            onClick={toggleAll}
            disabled={filtered.length === 0}
            className="hidden md:inline-flex"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
          <Button variant="secondary" size="sm" icon={<Download size={13} aria-hidden />} onClick={() => exportAs("csv")} disabled={filtered.length === 0} title={exportCaption}>
            CSV
          </Button>
          <Button variant="secondary" size="sm" icon={<Download size={13} aria-hidden />} onClick={() => exportAs("md")} disabled={filtered.length === 0} title={exportCaption}>
            Markdown
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
          <>
            {/* Phones get a single column of cards; wider screens get the table. */}
            <ul className="space-y-2 md:hidden">
              {filtered.map((tc) => (
                <TestCaseCard key={tc.id} tc={tc} open={openIds.has(tc.id)} onToggle={() => toggleRow(tc.id)} />
              ))}
            </ul>
            <div className="hidden max-h-[62vh] overflow-auto rounded-panel border border-edge bg-black/20 md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
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
          </>
        )}
      </div>

      <p className="mt-2 flex min-h-[14px] flex-wrap items-center gap-x-3 font-mono text-2xs text-fg-dim">
        <span className="tabular">
          {filtered.length} of {cases.length} test cases
        </span>
        <span role="status" aria-live="polite" className={clsx(notice?.tone === "fail" ? "text-red-300" : "text-emerald-300")}>
          {notice?.text}
        </span>
      </p>
    </div>
  );
}
