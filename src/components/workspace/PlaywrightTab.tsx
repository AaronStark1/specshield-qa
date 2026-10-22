import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Braces, Check, Copy, Download, FileCode, Info, Layers, X } from "lucide-react";
import type { PlaywrightSuite } from "@shared/types.js";
import { copyText } from "../../lib/clipboard.ts";
import { downloadText } from "../../lib/download.ts";
import { countLines, formatNumber, formatPercent } from "../../lib/format.ts";
import { Button } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { Tab, Tabs } from "../ui/Tabs.tsx";
import { Tooltip } from "../ui/Tooltip.tsx";
import { CodeBlock } from "./CodeBlock.tsx";

export interface PlaywrightTabProps {
  suite: PlaywrightSuite | null;
  /** Number of cases in the QA matrix — the coverage denominator. */
  totalCases?: number;
  /** QA matrix case ids. Enables the uncovered-case list and ignores mappings to unknown ids. */
  caseIds?: string[];
  runTitle?: string;
}

interface SuiteFile {
  key: string;
  kind: "spec" | "page" | "combined";
  label: string;
  /** Name used when downloading this file. */
  fileName: string;
  code: string;
}

function combinedFileName(specName: string): string {
  if (/\.spec\.ts$/.test(specName)) return specName.replace(/\.spec\.ts$/, ".combined.spec.ts");
  if (/\.ts$/.test(specName)) return specName.replace(/\.ts$/, ".combined.ts");
  return `${specName}.combined.ts`;
}

function suiteFiles(suite: PlaywrightSuite | null): SuiteFile[] {
  if (!suite) return [];
  return [
    { key: "spec", kind: "spec", label: suite.fileName, fileName: suite.fileName, code: suite.specCode },
    ...suite.pageObjects.map<SuiteFile>((p, i) => ({ key: `po:${i}:${p.fileName}`, kind: "page", label: p.fileName, fileName: p.fileName, code: p.code })),
    { key: "combined", kind: "combined", label: `${suite.fileName} · combined`, fileName: combinedFileName(suite.fileName), code: suite.combinedCode },
  ];
}

const FILE_ICON = {
  spec: <FileCode size={13} aria-hidden />,
  page: <Braces size={13} aria-hidden />,
  combined: <Layers size={13} aria-hidden />,
} as const;

const UNCOVERED_PREVIEW = 20;

/** State that snaps back to `initial` after `ms` (copy / download feedback). */
function useTransient<T>(initial: T, ms: number): [T, (v: T) => void] {
  const [value, setValue] = useState(initial);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      window.clearTimeout(timer.current);
      if (next !== initial) timer.current = window.setTimeout(() => setValue(initial), ms);
    },
    [initial, ms]
  );
  return [value, set];
}

function plural(n: number, word: string): string {
  return `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;
}

export function PlaywrightTab({ suite, totalCases, caseIds, runTitle }: PlaywrightTabProps) {
  const files = useMemo(() => suiteFiles(suite), [suite]);
  const [activeKey, setActiveKey] = useState("spec");
  const active = files.find((f) => f.key === activeKey) ?? files[0] ?? null;
  const [copyState, setCopyState] = useTransient<"idle" | "ok" | "fail">("idle", 1500);
  const [downloadFailed, setDownloadFailed] = useTransient(false, 2500);

  const coverage = useMemo(() => {
    if (!suite) return null;
    const mapped = new Set(suite.coverage.map((c) => c.testCaseId));
    if (caseIds) {
      const known = new Set(caseIds);
      let covered = 0;
      let unknown = 0;
      for (const id of mapped) {
        if (known.has(id)) covered += 1;
        else unknown += 1;
      }
      const uncovered = [...known].filter((id) => !mapped.has(id));
      return { covered, total: totalCases ?? caseIds.length, uncovered, unknown, mappedTests: suite.coverage.length };
    }
    return { covered: mapped.size, total: totalCases, uncovered: null, unknown: 0, mappedTests: suite.coverage.length };
  }, [suite, caseIds, totalCases]);

  const metrics = useMemo(() => {
    if (!active) return null;
    return {
      lines: countLines(active.code),
      chars: active.code.length,
      testBlocks: (active.code.match(/\btest\(/g) ?? []).length,
    };
  }, [active]);

  if (!suite || !active || !coverage || !metrics) {
    return (
      <EmptyState
        icon={<FileCode size={16} aria-hidden />}
        title="No Playwright suite yet"
        hint="Run the pipeline to generate page objects and a .spec.ts. Files appear here exactly as the codegen agent wrote them."
      />
    );
  }

  const pct = coverage.total !== undefined && coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : null;
  const coverageTone = pct === null ? "text-fg-muted" : pct >= 90 ? "text-emerald-300" : "text-amber-300";
  const barTone = pct !== null && pct >= 90 ? "bg-emerald-400" : "bg-amber-400";
  const coverageText = pct === null ? plural(coverage.mappedTests, "mapped test") : `${coverage.covered}/${coverage.total} · ${formatPercent(coverage.covered, coverage.total ?? 0)}`;

  const onCopy = async () => {
    const ok = await copyText(active.code);
    setCopyState(ok ? "ok" : "fail");
  };
  const onDownload = () => {
    const ok = downloadText(active.fileName, active.code, "text/typescript");
    setDownloadFailed(!ok);
  };

  const activeIndex = files.indexOf(active);
  const feedback = copyState === "ok" ? "Copied" : copyState === "fail" ? "Copy failed" : downloadFailed ? "Download failed" : "";

  return (
    <div className="min-w-0">
      {/* Toolbar row 1: file selector + coverage */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tabs label={runTitle ? `Generated files for ${runTitle}` : "Generated files"} className="min-w-0">
          {files.map((f, i) => (
            <Tab
              key={f.key}
              id={`pw-file-${i}`}
              controls="pw-file-panel"
              active={f.key === active.key}
              onClick={() => setActiveKey(f.key)}
              icon={FILE_ICON[f.kind]}
              count={countLines(f.code)}
              title={f.kind === "combined" ? "Single-file version: page objects inlined above the tests" : f.fileName}
            >
              <span className="font-mono text-[11px]">{f.label}</span>
            </Tab>
          ))}
        </Tabs>

        <div className="ml-auto flex items-center gap-2 font-mono text-2xs">
          <span className="uppercase tracking-wider text-fg-dim">coverage</span>
          <span className={clsx("tabular", coverageTone)}>{coverageText}</span>
          {pct !== null && (
            <span
              role="meter"
              aria-label="Case coverage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, pct)}
              className="h-1 w-20 overflow-hidden rounded-full bg-white/[0.06]"
            >
              <span className={clsx("block h-full rounded-full", barTone)} style={{ width: `${Math.min(100, pct)}%` }} />
            </span>
          )}
          <Tooltip
            side="bottom"
            align="end"
            wide
            content={
              coverage.uncovered === null ? (
                <span>Coverage is derived from the generated test → case mappings reported by the codegen agent.</span>
              ) : coverage.uncovered.length === 0 ? (
                <span>Every case in the matrix is referenced by at least one generated test.</span>
              ) : (
                <span className="block">
                  <span className="block font-mono text-2xs uppercase tracking-wider text-amber-300">
                    {plural(coverage.uncovered.length, "uncovered case")}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] leading-relaxed text-fg-muted">
                    {coverage.uncovered.slice(0, UNCOVERED_PREVIEW).join(", ")}
                    {coverage.uncovered.length > UNCOVERED_PREVIEW && ` … and ${coverage.uncovered.length - UNCOVERED_PREVIEW} more`}
                  </span>
                  {coverage.unknown > 0 && (
                    <span className="mt-1 block text-fg-dim">
                      {plural(coverage.unknown, "mapping")} reference ids that are not in the matrix and are not counted.
                    </span>
                  )}
                </span>
              )
            }
          >
            <button
              type="button"
              aria-label="Coverage details"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-fg-dim transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            >
              <Info size={13} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Toolbar row 2: metrics + actions */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="tabular font-mono text-2xs text-fg-dim">
          {plural(metrics.lines, "line")} · {plural(metrics.chars, "char")} · {plural(metrics.testBlocks, "test() block")} ·{" "}
          {plural(suite.pageObjects.length, "page object")}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            role="status"
            aria-live="polite"
            className={clsx("font-mono text-2xs", copyState === "fail" || downloadFailed ? "text-red-300" : "text-emerald-300")}
          >
            {feedback}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCopy}
            icon={
              copyState === "ok" ? (
                <Check size={13} aria-hidden className="text-emerald-300" />
              ) : copyState === "fail" ? (
                <X size={13} aria-hidden className="text-red-300" />
              ) : (
                <Copy size={13} aria-hidden />
              )
            }
          >
            Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={onDownload} icon={<Download size={13} aria-hidden />} title={`Download ${active.fileName}`}>
            Download
          </Button>
        </div>
      </div>

      <div role="tabpanel" id="pw-file-panel" aria-labelledby={`pw-file-${activeIndex}`} className="min-w-0">
        <CodeBlock code={active.code} language="ts" fileName={active.fileName} />
      </div>
    </div>
  );
}
