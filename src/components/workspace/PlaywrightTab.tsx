import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { PlaywrightSuite } from "@shared/types.js";
import { downloadText } from "../../lib/download.ts";
import { GhostButton } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { CodeBlock } from "./CodeBlock.tsx";

export function PlaywrightTab({ suite }: { suite: PlaywrightSuite | null }) {
  const [file, setFile] = useState<string>("combined");
  const [copied, setCopied] = useState(false);
  const files = useMemo(() => {
    if (!suite) return [];
    return [{ key: "combined", label: suite.fileName }, ...suite.pageObjects.map((p) => ({ key: p.fileName, label: p.fileName }))];
  }, [suite]);

  if (!suite) return <EmptyState title="No Playwright suite yet" hint="Run the pipeline to generate POMs and a .spec.ts." />;

  const activeCode = file === "combined" ? suite.combinedCode : (suite.pageObjects.find((p) => p.fileName === file)?.code ?? suite.specCode);
  const covered = suite.coverage.length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select value={file} onChange={(e) => setFile(e.target.value)} className="rounded-lg border border-[#1f2937] bg-[#0b0f17] px-2 py-1.5 font-mono text-xs">
          <option value="combined">{suite.fileName} (combined)</option>
          {suite.pageObjects.map((p) => <option key={p.fileName} value={p.fileName}>{p.className} · {p.fileName}</option>)}
        </select>
        <GhostButton
          onClick={async () => {
            await navigator.clipboard.writeText(activeCode).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</GhostButton>
        <GhostButton onClick={() => downloadText(suite.fileName, suite.combinedCode, "text/typescript")}>
          <Download size={14} /> Download .spec.ts
        </GhostButton>
        <span className="ml-auto font-mono text-[11px] text-emerald-300">{covered} of {covered} test cases covered</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {files.slice(1).map((f) => (
          <button key={f.key} onClick={() => setFile(f.key)} className={`rounded border px-2 py-0.5 font-mono text-[11px] ${file === f.key ? "border-emerald-500/60 text-emerald-200" : "border-[#1f2937] text-[#9ca3af]"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <CodeBlock code={activeCode} />
    </div>
  );
}
