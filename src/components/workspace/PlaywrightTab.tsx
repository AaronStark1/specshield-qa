import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Braces, Check, Copy, FileArchive, FileCode, Info, Layers, X } from "lucide-react";
import type { PlaywrightSuite } from "@shared/types.js";
import { copyText } from "../../lib/clipboard.ts";
import { downloadBlob, safeFilename } from "../../lib/download.ts";
import { formatNumber } from "../../lib/format.ts";
import { createZip } from "../../lib/zip.ts";
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

  const testCount = useMemo(() => (suite ? (suite.specCode.match(/\btest\(/g) ?? []).length : 0), [suite]);

  if (!suite || !active || !coverage) {
    return (
      <EmptyState
        icon={<FileCode size={16} aria-hidden />}
        title="No Playwright suite yet"
        hint="Generate a test suite to get a .spec.ts file and its page objects, ready to copy or download."
      />
    );
  }

  const pct = coverage.total !== undefined && coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : null;
  const coverageTone = pct === null ? "text-fg-muted" : pct >= 90 ? "text-emerald-300" : "text-amber-300";
  const coverageText = pct === null ? plural(coverage.mappedTests, "mapped test") : `${coverage.covered}/${coverage.total} cases covered`;
  const zipName = safeFilename([suite.fileName.replace(/\.spec\.ts$/, ""), "playwright-suite"], "zip");

  const onCopySuite = async () => {
    const ok = await copyText(suite.combinedCode);
    setCopyState(ok ? "ok" : "fail");
  };
  const onDownloadZip = () => {
    const ok = downloadBlob(
      zipName,
      createZip([
        { path: suite.fileName, content: suite.specCode },
        ...suite.pageObjects.map((po) => ({ path: `pages/${po.fileName}`, content: po.code })),
      ])
    );
    setDownloadFailed(!ok);
  };

  const activeIndex = files.indexOf(active);
  const feedback = copyState === "ok" ? "Suite copied" : copyState === "fail" ? "Copy failed" : downloadFailed ? "Download failed" : "";

  return (
    <div className="min-w-0">
      {/* Suite summary + the two primary actions */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="tabular flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
          <span>
            {plural(testCount, "test")} · {plural(suite.pageObjects.length, "page object")}
          </span>
          <span aria-hidden className="text-fg-faint">
            ·
          </span>
          <span className={coverageTone}>{coverageText}</span>
          {coverage.uncovered !== null && coverage.uncovered.length > 0 && (
            <Tooltip
              side="bottom"
              wide
              content={
                <span className="block">
                  <span className="block font-mono text-2xs uppercase tracking-wider text-amber-300">
                    {plural(coverage.uncovered.length, "case")} without a test
                  </span>
                  <span className="mt-1 block font-mono text-[11px] leading-relaxed text-fg-muted">
                    {coverage.uncovered.slice(0, UNCOVERED_PREVIEW).join(", ")}
                    {coverage.uncovered.length > UNCOVERED_PREVIEW && ` … and ${coverage.uncovered.length - UNCOVERED_PREVIEW} more`}
                  </span>
                </span>
              }
            >
              <button
                type="button"
                aria-label="Cases without a test"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-fg-dim transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              >
                <Info size={13} aria-hidden />
              </button>
            </Tooltip>
          )}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <span
            role="status"
            aria-live="polite"
            className={clsx("text-xs", copyState === "fail" || downloadFailed ? "text-red-300" : "text-emerald-300")}
          >
            {feedback}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCopySuite}
            title="Copy the whole suite as a single file"
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
            Copy Suite
          </Button>
          <Button size="sm" onClick={onDownloadZip} icon={<FileArchive size={13} aria-hidden />} title={`Download ${zipName}: the spec file plus pages/`}>
            Download .zip
          </Button>
        </div>
      </div>

      {/* File selector */}
      <div className="mb-2">
        <Tabs label={runTitle ? `Generated files for ${runTitle}` : "Generated files"} className="min-w-0">
          {files.map((f, i) => (
            <Tab
              key={f.key}
              id={`pw-file-${i}`}
              controls="pw-file-panel"
              active={f.key === active.key}
              onClick={() => setActiveKey(f.key)}
              icon={FILE_ICON[f.kind]}
              title={f.kind === "combined" ? "Single-file version: page objects inlined above the tests" : f.fileName}
            >
              <span className="font-mono text-[11px]">{f.label}</span>
            </Tab>
          ))}
        </Tabs>
      </div>

      <div role="tabpanel" id="pw-file-panel" aria-labelledby={`pw-file-${activeIndex}`} className="min-w-0">
        <CodeBlock code={active.code} language="ts" fileName={active.fileName} />
      </div>
    </div>
  );
}
