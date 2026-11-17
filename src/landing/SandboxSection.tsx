import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { ArrowRight, Check, Copy, Drama, FileArchive, FileText, Table2, type LucideIcon } from "lucide-react";
import { SAMPLE_SPEC } from "@shared/sampleSpec.ts";
import type { TestCase, TestCategory } from "@shared/types.js";
import { CodeBlock } from "../components/workspace/CodeBlock.tsx";
import { TEST_CASE_ROW_COLUMNS, TestCaseCard, TestCaseRow } from "../components/workspace/TestCaseRow.tsx";
import { copyText } from "../lib/clipboard.ts";
import { downloadBlob } from "../lib/download.ts";
import { formatNumber } from "../lib/format.ts";
import { Link } from "../lib/router.tsx";
import { CATEGORIES, categoryCounts } from "../lib/runs.ts";
import { DEFAULT_SAMPLE_ID } from "../lib/samples.ts";
import { createZip } from "../lib/zip.ts";
import { Reveal } from "./Reveal.tsx";
import { SpotlightGroup } from "./Spotlight.tsx";
import { Window } from "./Window.tsx";
import { useInView } from "./hooks.ts";

/** The suite the offline engine produces for the Invoice Tracker spec (see scripts/build-demo-suite.ts). */
interface DemoSuite {
  title: string;
  testCases: TestCase[];
  playwright: { fileName: string; specCode: string; pageObjects: { fileName: string; code: string }[] };
}

type TabId = "prd" | "matrix" | "code";
type CategoryFilter = "All" | TestCategory;

const FILTER_TONE: Record<CategoryFilter, string> = {
  All: "border-white/25 bg-white/[0.08] text-white",
  Functional: "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
  Boundary: "border-amber-500/50 bg-amber-500/15 text-amber-200",
  Negative: "border-violet-500/50 bg-violet-500/15 text-violet-200",
  Security: "border-cyan-500/50 bg-cyan-500/15 text-cyan-200",
};

/** Loads the demo suite in its own chunk the first time the sandbox comes near the viewport. */
function useDemoSuite(enabled: boolean): DemoSuite | null {
  const [suite, setSuite] = useState<DemoSuite | null>(null);
  useEffect(() => {
    if (!enabled || suite) return;
    let cancelled = false;
    void import("./sandbox/demoSuite.json").then((module) => {
      if (!cancelled) setSuite(module.default as DemoSuite);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, suite]);
  return suite;
}

function specLineClass(line: string): string {
  if (line.startsWith("# ")) return "font-semibold text-white";
  if (line.startsWith("## ")) return "text-emerald-300";
  if (line.startsWith("### ")) return "text-emerald-200";
  return "text-[var(--text-muted)]";
}

/** Tab 1 — the raw spec, lightly coloured: headings, requirement ids, role names. */
function PrdPanel() {
  const lines = useMemo(() => SAMPLE_SPEC.split("\n"), []);
  return (
    <div>
      <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[12px] leading-[1.7]">
        {lines.map((line, i) => {
          const requirement = line.match(/^(- )((?:FR|NFR)-[A-Z0-9]+-\d+)(:.*)$/);
          const role = line.match(/^(- )\*\*(.+?)\*\*(.*)$/);
          return (
            <span key={i} className={clsx("block min-h-[1.7em]", specLineClass(line))}>
              {requirement ? (
                <>
                  {requirement[1]}
                  <span className="text-cyan-300">{requirement[2]}</span>
                  {requirement[3]}
                </>
              ) : role ? (
                <>
                  {role[1]}
                  <span className="font-semibold text-white">{role[2]}</span>
                  {role[3]}
                </>
              ) : (
                line
              )}
            </span>
          );
        })}
      </pre>
      <PanelFooter>
        {formatNumber(SAMPLE_SPEC.length)} characters · the bundled Freelancer Invoice Tracker spec, exactly as the studio receives it
      </PanelFooter>
    </div>
  );
}

/** Tab 2 — the generated cases, filterable by category; rows expand to Given / When / Then. */
function MatrixPanel({ cases }: { cases: TestCase[] }) {
  const [filter, setFilter] = useState<CategoryFilter>("All");
  const [openCard, setOpenCard] = useState<string | null>(null);
  const counts = useMemo(() => ({ All: cases.length, ...categoryCounts(cases) }), [cases]);
  const visible = filter === "All" ? cases : cases.filter((c) => c.category === filter);

  return (
    <div>
      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5 border-b border-white/[0.08] px-5 py-3">
        {(["All", ...CATEGORIES] as CategoryFilter[]).map((category) => {
          const active = filter === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(category)}
              className={clsx(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                active ? FILTER_TONE[category] : "border-white/[0.1] text-[var(--text-muted)] hover:border-white/25 hover:text-white",
              )}
            >
              {category}
              <span className="tabular text-[11px] opacity-80">{counts[category]}</span>
            </button>
          );
        })}
      </div>

      <ul className="max-h-[440px] space-y-2 overflow-auto p-3 md:hidden">
        {visible.map((tc) => (
          <TestCaseCard key={tc.id} tc={tc} open={openCard === tc.id} onToggle={() => setOpenCard(openCard === tc.id ? null : tc.id)} />
        ))}
      </ul>
      <div className="hidden max-h-[440px] overflow-auto md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0a0f17]">
            <tr>
              {["ID", "Category", "Priority", "Title", "Feature"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-3 py-2 font-mono text-2xs font-medium uppercase tracking-wider text-fg-dim shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
                >
                  {heading}
                </th>
              ))}
              <th scope="col" className="w-8 px-2 py-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((tc) => (
              <TestCaseRow key={tc.id} tc={tc} colSpan={TEST_CASE_ROW_COLUMNS} />
            ))}
          </tbody>
        </table>
      </div>
      <PanelFooter>
        Showing {visible.length} of {cases.length} cases · click a row for its Given / When / Then
      </PanelFooter>
    </div>
  );
}

/** Tab 3 — the generated spec file, with copy and a zip of the whole suite. */
function CodePanel({ suite }: { suite: DemoSuite }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const { fileName, specCode, pageObjects } = suite.playwright;
  const onCopy = async () => {
    setCopied((await copyText(specCode)) ? "ok" : "fail");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied("idle"), 1600);
  };
  const onDownload = () => {
    downloadBlob(
      "invoice-tracker-demo-suite.zip",
      createZip([{ path: fileName, content: specCode }, ...pageObjects.map((po) => ({ path: `pages/${po.fileName}`, content: po.code }))]),
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-5 py-3">
        <span className="tabular text-xs text-[var(--text-muted)]">
          {suite.testCases.length} tests · {pageObjects.length} page objects
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onCopy()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.16] bg-white/[0.04] px-3 text-xs font-medium text-white transition-colors hover:border-emerald-500/50"
          >
            {copied === "ok" ? <Check size={13} className="text-emerald-300" aria-hidden /> : <Copy size={13} aria-hidden />}
            <span aria-live="polite">{copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy Code"}</span>
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-emerald-950 transition-colors hover:bg-[var(--accent-light)]"
          >
            <FileArchive size={13} aria-hidden />
            Download Demo Suite
          </button>
        </div>
      </div>
      <CodeBlock code={specCode} language="ts" fileName={fileName} maxHeight="400px" className="rounded-none border-0" />
    </div>
  );
}

function PanelFooter({ children }: { children: ReactNode }) {
  return <p className="border-t border-white/[0.08] px-5 py-3 font-mono text-[11px] text-[var(--text-dim)]">{children}</p>;
}

const TABS: { id: TabId; label: string; short: string; icon: LucideIcon }[] = [
  { id: "prd", label: "Raw PRD Input", short: "PRD", icon: FileText },
  { id: "matrix", label: "Generated Test Matrix (30 Cases)", short: "Matrix", icon: Table2 },
  { id: "code", label: "Playwright POM Suite", short: "Code", icon: Drama },
];

/** Interactive mini-studio: the real input and the real output for the bundled sample, side by side as tabs. */
export function SandboxSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const near = useInView(sectionRef, { rootMargin: "600px 0px", once: true });
  const suite = useDemoSuite(near);
  const [tab, setTab] = useState<TabId>("prd");

  return (
    <section ref={sectionRef} id="sandbox" className="landing-section" aria-labelledby="sandbox-title">
      <div className="landing-container">
        <Reveal>
          <p className="section-eyebrow">Before / after</p>
          <h2 id="sandbox-title" className="section-title mt-4 max-w-[760px]">
            <span className="text-matrix-gradient">Try the engine without leaving this page</span>
          </h2>
          <p className="mt-5 max-w-[640px] text-[16px] leading-relaxed text-[var(--text-muted)]">
            One spec in, a filterable matrix and a Playwright suite out. This is the actual output for the bundled Invoice Tracker spec.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-12">
          <SpotlightGroup>
            <div className="spotlight-card rounded-[14px]">
              <Window title="specshield · studio preview" className="window-terminal">
                <div role="tablist" aria-label="Studio preview" className="flex gap-1 overflow-x-auto border-b border-white/[0.08] px-3 pt-3">
                  {TABS.map((item) => {
                    const active = tab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        id={`sandbox-tab-${item.id}`}
                        aria-selected={active}
                        aria-controls="sandbox-panel"
                        onClick={() => setTab(item.id)}
                        className={clsx(
                          "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-t-lg px-4 text-[13px] font-medium transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                          active ? "bg-white/[0.06] text-white" : "text-[var(--text-muted)] hover:text-white",
                        )}
                      >
                        <Icon size={14} className={active ? "text-[var(--accent-light)]" : undefined} aria-hidden />
                        <span className="hidden sm:inline">{item.label}</span>
                        <span className="sm:hidden">{item.short}</span>
                        {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />}
                      </button>
                    );
                  })}
                </div>

                <div role="tabpanel" id="sandbox-panel" aria-labelledby={`sandbox-tab-${tab}`} className="min-h-[500px]">
                  {tab === "prd" && <PrdPanel />}
                  {tab !== "prd" && !suite && <p className="p-5 font-mono text-xs text-[var(--text-dim)]">Loading the demo suite…</p>}
                  {tab === "matrix" && suite && <MatrixPanel cases={suite.testCases} />}
                  {tab === "code" && suite && <CodePanel suite={suite} />}
                </div>
              </Window>
            </div>
          </SpotlightGroup>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-6 text-[14px] text-[var(--text-muted)]">
            Want to run it on your own spec?{" "}
            <Link to={`/studio?sample=${DEFAULT_SAMPLE_ID}`} className="inline-flex items-center gap-1 font-medium text-[var(--accent-light)] hover:text-white">
              Open the full studio <ArrowRight size={14} aria-hidden />
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
