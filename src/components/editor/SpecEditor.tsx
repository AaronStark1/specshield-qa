import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { FileText } from "lucide-react";
import { SAMPLE_SPEC_TITLE } from "@shared/sampleSpec.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { MIN_SPEC_CHARS } from "../../hooks/usePipeline.ts";
import { countLines, estimateTokens, formatNumber, formatTokens } from "../../lib/format.ts";
import { Badge } from "../ui/Badge.tsx";
import { Panel } from "../ui/Panel.tsx";
import { Tab, Tabs } from "../ui/Tabs.tsx";
import { InlineConfirm, RunControls, clearSpec, loadSampleSpec, specSource, useEscapeDismiss } from "./LoadSampleButton.tsx";

const PLACEHOLDER =
  "Paste a PRD: roles, requirements, limits (e.g. 10 MB, 12–64 chars), security notes…\n\n" +
  `Minimum ${MIN_SPEC_CHARS} characters. Processed by the local API on this machine.`;

const SOURCE_BADGE = {
  sample: { tone: "cyan", text: "SAMPLE", title: "Bundled Invoice Tracker PRD" },
  custom: { tone: "emerald", text: "CUSTOM", title: "Your own specification" },
  empty: { tone: "gray", text: "EMPTY", title: "No specification yet" },
} as const;

/**
 * Specification workbench: template selector, length/validity strip, the PRD textarea,
 * run title and run controls. Renders exactly one Panel so App can place it directly.
 */
export function SpecEditor() {
  const spec = usePipelineStore((s) => s.spec);
  const setSpec = usePipelineStore((s) => s.setSpec);
  const title = usePipelineStore((s) => s.title);
  const setTitle = usePipelineStore((s) => s.setTitle);
  const running = usePipelineStore((s) => s.running);

  const [confirmReplace, setConfirmReplace] = useState(false);
  useEscapeDismiss(() => setConfirmReplace(false));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stripId = useId();

  const source = specSource(spec);
  const chars = spec.length;
  const trimmed = spec.trim().length;
  const remaining = Math.max(0, MIN_SPEC_CHARS - trimmed);
  const valid = remaining === 0;
  const progress = Math.min(100, Math.round((trimmed / MIN_SPEC_CHARS) * 100));

  // Warn before the tab closes while a run is in flight or an unsaved custom spec is present.
  const protectInput = running || source === "custom";
  useEffect(() => {
    if (!protectInput) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers key off a non-empty returnValue; modern ones show their own generic text.
      e.returnValue = "Unsaved specification";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [protectInput]);

  const focusEditor = () => textareaRef.current?.focus();

  const selectSample = () => {
    if (source === "sample") return;
    if (source === "custom") {
      setConfirmReplace(true);
      return;
    }
    loadSampleSpec();
  };

  const selectCustom = () => {
    if (source === "sample") {
      // The sample is one click away, so no confirm: clear the text and its title.
      if (title === SAMPLE_SPEC_TITLE) clearSpec();
      else setSpec("");
    }
    focusEditor();
  };

  const badge = SOURCE_BADGE[source];

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          Specification
          <Badge tone={badge.tone} mono size="xs" title={badge.title}>
            {badge.text}
          </Badge>
        </span>
      }
      subtitle="PRD → test matrix"
      icon={<FileText size={14} />}
      actions={
        <Tabs label="Specification template">
          <Tab active={source === "sample"} onClick={selectSample} disabled={running} title="Load the bundled Invoice Tracker PRD">
            Sample · Invoice Tracker
          </Tab>
          <Tab active={source !== "sample"} onClick={selectCustom} disabled={running} title="Write or paste your own PRD">
            Custom
          </Tab>
        </Tabs>
      }
    >
      <div className="space-y-3">
        {confirmReplace && (
          <InlineConfirm
            question="Replace custom spec with the sample?"
            onConfirm={() => {
              loadSampleSpec();
              setConfirmReplace(false);
            }}
            onCancel={() => setConfirmReplace(false)}
          />
        )}

        {/* Health strip: counts + validity toward MIN_SPEC_CHARS */}
        <div id={stripId} className="tabular font-mono text-2xs text-fg-dim">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span>
              {formatNumber(chars)} chars · {formatNumber(countLines(spec))} lines · ≈ {formatTokens(estimateTokens(chars))} tokens{" "}
              <span className="text-fg-faint">(est.)</span>
            </span>
            {valid ? (
              <Badge tone="emerald" dot mono size="xs" label="Specification is long enough to run">
                READY
              </Badge>
            ) : (
              <span className="text-amber-300">
                {formatNumber(remaining)} more char{remaining === 1 ? "" : "s"} to run
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Minimum specification length"
            aria-valuemin={0}
            aria-valuemax={MIN_SPEC_CHARS}
            aria-valuenow={Math.min(trimmed, MIN_SPEC_CHARS)}
            className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
          >
            <div
              className={clsx("h-full transition-[width] duration-200 ease-out-soft", valid ? "bg-emerald-400/80" : "bg-amber-400/80")}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          aria-label="Product specification"
          aria-describedby={stripId}
          className="field min-h-[360px] resize-y font-mono text-[12.5px] leading-relaxed"
        />

        <label className="block">
          <span className="mb-1 block font-mono text-2xs uppercase tracking-wider text-fg-dim">Run title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Invoice Tracker v1.0"
            maxLength={120}
            className="field"
          />
        </label>

        <RunControls />
      </div>
    </Panel>
  );
}
