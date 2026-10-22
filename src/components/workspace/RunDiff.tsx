import { useMemo, type ReactNode } from "react";
import { clsx } from "clsx";
import { AlertTriangle, GitCompare, X } from "lucide-react";
import type { Priority, RunRecord, TestCase, TestCategory } from "@shared/types.js";
import { formatDate, formatDuration, formatHours, formatTokens, formatUsd } from "../../lib/format.ts";
import {
  CATEGORIES,
  PRIORITIES,
  categoryCounts,
  categoryTone,
  modeTone,
  priorityCounts,
  priorityTone,
  runDurationMs,
  outcomeTone,
  runOutcome,
  tokenTotals,
} from "../../lib/runs.ts";
import { Badge, type BadgeTone } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";

// Re-exported for backward compatibility; the implementation lives in src/lib/runs.ts.
export { outcomeTone };

export interface RunDiffProps {
  /** The current run. */
  a: RunRecord;
  /** The previous run it is compared against. */
  b: RunRecord;
  onClose: () => void;
}

type Sign = "pos" | "neg" | "zero";
const signOf = (n: number): Sign => (n > 0 ? "pos" : n < 0 ? "neg" : "zero");

/** "+3", "−1.2 hrs", "0" — never relies on the formatter to render a sign. */
function signed(n: number, fmt: (abs: number) => string = (v) => String(v)): string {
  if (!Number.isFinite(n)) return "—";
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `−${fmt(-n)}`;
  return fmt(0);
}

const signColour: Record<Sign, string> = { pos: "text-emerald-300", neg: "text-red-300", zero: "text-fg-muted" };

const dotColour: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
  red: "bg-red-400",
  sky: "bg-sky-400",
  gray: "bg-fg-dim",
};

interface CaseRef {
  id: string;
  title: string;
}
interface IdDiff {
  added: CaseRef[];
  removed: CaseRef[];
  changed: { id: string; before: string; after: string }[];
  dupA: string[];
  dupB: string[];
}

/** Index cases by id; ids that occur more than once are reported separately and dropped from the map. */
function indexById(cases: TestCase[]): { unique: Map<string, TestCase>; dups: string[] } {
  const unique = new Map<string, TestCase>();
  const dupSet = new Set<string>();
  for (const c of cases) {
    if (unique.has(c.id)) dupSet.add(c.id);
    else unique.set(c.id, c);
  }
  const dups = [...dupSet];
  for (const id of dups) unique.delete(id);
  return { unique, dups };
}

/** Stable-id diff. Never infers additions from array position; duplicate ids are excluded on both sides. */
function diffIds(a: TestCase[], b: TestCase[]): IdDiff {
  const ia = indexById(a);
  const ib = indexById(b);
  const excluded = new Set([...ia.dups, ...ib.dups]);
  for (const id of excluded) {
    ia.unique.delete(id);
    ib.unique.delete(id);
  }
  const added: CaseRef[] = [];
  const changed: IdDiff["changed"] = [];
  for (const [id, c] of ia.unique) {
    const prev = ib.unique.get(id);
    if (!prev) added.push({ id, title: c.title });
    else if (prev.title.trim() !== c.title.trim()) changed.push({ id, before: prev.title, after: c.title });
  }
  const removed: CaseRef[] = [];
  for (const [id, c] of ib.unique) if (!ia.unique.has(id)) removed.push({ id, title: c.title });
  return { added, removed, changed, dupA: ia.dups, dupB: ib.dups };
}

function Tile({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-edge bg-black/20 px-2.5 py-2">
      <div className="font-mono text-2xs uppercase tracking-wider text-fg-dim">{label}</div>
      <div className={clsx("tabular mt-0.5 truncate font-mono text-13 font-semibold text-fg", className)}>{value}</div>
      {sub !== undefined && <div className="tabular mt-0.5 truncate font-mono text-2xs text-fg-dim">{sub}</div>}
    </div>
  );
}

function DistTable<K extends string>({
  caption,
  rows,
  prev,
  cur,
  dot,
}: {
  caption: string;
  rows: K[];
  prev: Record<K, number>;
  cur: Record<K, number>;
  dot: (k: K) => string;
}) {
  const totalPrev = rows.reduce((s, k) => s + prev[k], 0);
  const totalCur = rows.reduce((s, k) => s + cur[k], 0);
  return (
    <table className="w-full border-collapse text-xs">
      <caption className="mb-1 text-left font-mono text-2xs uppercase tracking-wider text-fg-dim">{caption}</caption>
      <thead>
        <tr className="font-mono text-2xs text-fg-dim">
          <th scope="col" className="pb-1 text-left font-medium">
            &nbsp;
          </th>
          <th scope="col" className="pb-1 text-right font-medium">
            prev
          </th>
          <th scope="col" className="pb-1 text-right font-medium">
            cur
          </th>
          <th scope="col" className="pb-1 text-right font-medium">
            Δ
          </th>
        </tr>
      </thead>
      <tbody className="tabular font-mono">
        {rows.map((k) => {
          const d = cur[k] - prev[k];
          return (
            <tr key={k} className="border-t border-edge-faint">
              <td className="py-1 pr-2">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", dotColour[dot(k)] ?? "bg-fg-dim")} />
                  <span className="text-fg">{k}</span>
                </span>
              </td>
              <td className="py-1 text-right text-fg-muted">{prev[k]}</td>
              <td className="py-1 text-right text-fg">{cur[k]}</td>
              <td className={clsx("py-1 text-right", signColour[signOf(d)])}>{signed(d)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot className="tabular font-mono">
        <tr className="border-t border-edge">
          <td className="py-1 pr-2 text-fg-dim">total</td>
          <td className="py-1 text-right text-fg-muted">{totalPrev}</td>
          <td className="py-1 text-right text-fg">{totalCur}</td>
          <td className={clsx("py-1 text-right", signColour[signOf(totalCur - totalPrev)])}>{signed(totalCur - totalPrev)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function IdList({ label, tone, items, max }: { label: string; tone: BadgeTone; items: CaseRef[]; max: number }) {
  const shown = items.slice(0, max);
  const more = items.length - shown.length;
  return (
    <div className="min-w-0">
      <div className="font-mono text-2xs uppercase tracking-wider text-fg-dim">
        {label} <span className="tabular text-fg-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-1 font-mono text-2xs text-fg-faint">none</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1">
          {shown.map((c) => (
            <li key={c.id}>
              <Badge tone={tone} size="xs" mono title={c.title}>
                {c.id}
              </Badge>
            </li>
          ))}
          {more > 0 && <li className="self-center font-mono text-2xs text-fg-dim">+{more} more</li>}
        </ul>
      )}
    </div>
  );
}

export function RunDiff({ a, b, onClose }: RunDiffProps) {
  const d = useMemo(() => {
    const casesA = a.testCases ?? [];
    const casesB = b.testCases ?? [];
    const telA = a.telemetry ?? [];
    const telB = b.telemetry ?? [];
    const durA = runDurationMs({ telemetry: telA });
    const durB = runDurationMs({ telemetry: telB });
    const tokA = tokenTotals(telA);
    const tokB = tokenTotals(telB);
    const hoursA = a.roi?.estimatedManualHours;
    const hoursB = b.roi?.estimatedManualHours;
    const usdA = a.roi?.billableValueUsd;
    const usdB = b.roi?.billableValueUsd;
    return {
      countA: casesA.length,
      countB: casesB.length,
      durA,
      durB,
      runtimeDelta: durA != null && durB != null ? durA - durB : null,
      tokA,
      tokB,
      tokensReported: tokA.reported && tokB.reported,
      hoursDelta: typeof hoursA === "number" && typeof hoursB === "number" ? hoursA - hoursB : null,
      usdDelta: typeof usdA === "number" && typeof usdB === "number" ? usdA - usdB : null,
      outcomeA: runOutcome(telA),
      outcomeB: runOutcome(telB),
      catA: categoryCounts(casesA),
      catB: categoryCounts(casesB),
      priA: priorityCounts(casesA),
      priB: priorityCounts(casesB),
      ids: diffIds(casesA, casesB),
    };
  }, [a, b]);

  const countDelta = d.countA - d.countB;
  const sameMode = a.mode === b.mode;
  const sameModel = (a.model || "") === (b.model || "");
  const sameOutcome = d.outcomeA === d.outcomeB;

  return (
    <section
      aria-label={`Comparison of ${b.title} with ${a.title}`}
      className="animate-fade-in rounded-panel border border-cyan-500/30 bg-cyan-500/[0.04] p-3 text-xs"
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <GitCompare size={13} className="shrink-0 text-cyan-300" aria-hidden />
        <span className="text-13 font-semibold text-fg">Compare</span>
        <span className="min-w-0 truncate font-mono text-2xs text-fg-muted">
          <span className="text-fg" title={b.id}>
            {b.title}
          </span>{" "}
          <span className="text-fg-dim">({formatDate(b.createdAt)})</span>
          <span className="mx-1.5 text-cyan-300/70">→</span>
          <span className="text-fg" title={a.id}>
            {a.title}
          </span>{" "}
          <span className="text-fg-dim">({formatDate(a.createdAt)})</span>
        </span>
        <Button variant="ghost" size="sm" icon={<X size={13} aria-hidden />} onClick={onClose} className="ml-auto" aria-label="Close comparison">
          Close
        </Button>
      </header>

      {/* Headline deltas */}
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile
          label="test cases"
          value={signed(countDelta)}
          className={signColour[signOf(countDelta)]}
          sub={`${d.countB} → ${d.countA}`}
        />
        <Tile
          label="runtime"
          value={d.runtimeDelta == null ? "—" : signed(d.runtimeDelta, formatDuration)}
          sub={d.runtimeDelta == null ? "duration missing on one side" : `${formatDuration(d.durB)} → ${formatDuration(d.durA)}`}
        />
        <Tile
          label="tokens"
          value={
            d.tokensReported ? (
              <>
                <span>in {signed(d.tokA.input - d.tokB.input, formatTokens)}</span>
                <span className="mx-1.5 text-fg-dim">·</span>
                <span>out {signed(d.tokA.output - d.tokB.output, formatTokens)}</span>
              </>
            ) : (
              "—"
            )
          }
          sub={
            d.tokensReported
              ? `${formatTokens(d.tokB.input)}/${formatTokens(d.tokB.output)} → ${formatTokens(d.tokA.input)}/${formatTokens(d.tokA.output)}`
              : `usage not reported (${!d.tokB.reported && !d.tokA.reported ? "both runs" : !d.tokB.reported ? "previous run" : "current run"})`
          }
        />
        <Tile
          label="ROI est."
          value={d.hoursDelta == null ? "—" : signed(d.hoursDelta, formatHours)}
          className={d.hoursDelta == null ? undefined : signColour[signOf(d.hoursDelta)]}
          sub={
            d.usdDelta == null ? (
              "ROI missing on one side"
            ) : (
              <span className={signColour[signOf(d.usdDelta)]}>{signed(d.usdDelta, (v) => formatUsd(v))} billable</span>
            )
          }
        />
      </div>

      {/* Execution differences */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-2xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="uppercase tracking-wider text-fg-dim">mode</span>
          {sameMode ? (
            <>
              <Badge tone={modeTone(a.mode)} mono size="xs">
                {a.mode}
              </Badge>
              <span className="text-fg-dim">same</span>
            </>
          ) : (
            <>
              <Badge tone={modeTone(b.mode)} mono size="xs">
                {b.mode}
              </Badge>
              <span className="text-cyan-300/70">→</span>
              <Badge tone={modeTone(a.mode)} mono size="xs">
                {a.mode}
              </Badge>
            </>
          )}
        </span>
        {!sameModel && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="uppercase tracking-wider text-fg-dim">model</span>
            <span className="truncate text-fg">{b.model || "—"}</span>
            <span className="text-cyan-300/70">→</span>
            <span className="truncate text-fg">{a.model || "—"}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="uppercase tracking-wider text-fg-dim">outcome</span>
          {sameOutcome ? (
            <>
              <Badge tone={outcomeTone(d.outcomeA)} mono size="xs">
                {d.outcomeA}
              </Badge>
              <span className="text-fg-dim">same</span>
            </>
          ) : (
            <>
              <Badge tone={outcomeTone(d.outcomeB)} mono size="xs">
                {d.outcomeB}
              </Badge>
              <span className="text-cyan-300/70">→</span>
              <Badge tone={outcomeTone(d.outcomeA)} mono size="xs">
                {d.outcomeA}
              </Badge>
            </>
          )}
        </span>
      </div>

      {/* Distribution tables */}
      <div className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
        <DistTable<TestCategory> caption="by category" rows={CATEGORIES} prev={d.catB} cur={d.catA} dot={categoryTone} />
        <DistTable<Priority> caption="by priority" rows={PRIORITIES} prev={d.priB} cur={d.priA} dot={priorityTone} />
      </div>

      {/* Stable-id diff */}
      {(d.ids.dupA.length > 0 || d.ids.dupB.length > 0) && (
        <div className="mt-3 space-y-1">
          {d.ids.dupA.length > 0 && (
            <p className="flex items-start gap-1.5 font-mono text-2xs text-amber-300">
              <AlertTriangle size={12} className="mt-px shrink-0" aria-hidden />
              <span>
                {d.ids.dupA.length} duplicate id{d.ids.dupA.length === 1 ? "" : "s"} in current run ({d.ids.dupA.join(", ")}); those ids are excluded
                from the add/remove diff.
              </span>
            </p>
          )}
          {d.ids.dupB.length > 0 && (
            <p className="flex items-start gap-1.5 font-mono text-2xs text-amber-300">
              <AlertTriangle size={12} className="mt-px shrink-0" aria-hidden />
              <span>
                {d.ids.dupB.length} duplicate id{d.ids.dupB.length === 1 ? "" : "s"} in previous run ({d.ids.dupB.join(", ")}); those ids are
                excluded from the add/remove diff.
              </span>
            </p>
          )}
        </div>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <IdList label="added" tone="emerald" items={d.ids.added} max={12} />
        <IdList label="removed" tone="red" items={d.ids.removed} max={12} />
      </div>
      {d.ids.changed.length > 0 && (
        <div className="mt-3 min-w-0">
          <div className="font-mono text-2xs uppercase tracking-wider text-fg-dim">
            changed title <span className="tabular text-fg-muted">{d.ids.changed.length}</span>
          </div>
          <ul className="mt-1 flex flex-wrap gap-1">
            {d.ids.changed.slice(0, 10).map((c) => (
              <li key={c.id}>
                <Badge tone="amber" size="xs" mono title={`${c.before} → ${c.after}`}>
                  {c.id}
                </Badge>
              </li>
            ))}
            {d.ids.changed.length > 10 && <li className="self-center font-mono text-2xs text-fg-dim">+{d.ids.changed.length - 10} more</li>}
          </ul>
        </div>
      )}
      <p className="mt-3 font-mono text-2xs text-fg-faint">
        Cases are matched by id (ids are assigned per run by the generator), never by position. Hover an id for its title.
      </p>
    </section>
  );
}
