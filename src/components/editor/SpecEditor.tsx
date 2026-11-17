import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { FileText, Sparkles } from "lucide-react";
import { SAMPLE_SPECS, type SampleSpec } from "@shared/sampleSpec.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { MIN_SPEC_CHARS } from "../../hooks/usePipeline.ts";
import { countLines, formatNumber } from "../../lib/format.ts";
import { SPEC_INPUT_ID, SPEC_PANEL_ID } from "../../lib/layout.ts";
import { loadSample, matchSample } from "../../lib/samples.ts";
import { Badge } from "../ui/Badge.tsx";
import { Panel } from "../ui/Panel.tsx";
import { InlineConfirm, RunControls, isCustomSpec, useEscapeDismiss } from "./RunControls.tsx";

const PLACEHOLDER =
  "Paste a PRD, user story or markdown spec: roles, requirements, limits (e.g. 8–64 characters), security notes…\n\n" +
  "Everything you paste here stays on this machine.";

/** Spec editor: one-click sample loaders, the PRD textarea, run title and run controls. */
export function SpecEditor() {
  const spec = usePipelineStore((s) => s.spec);
  const setSpec = usePipelineStore((s) => s.setSpec);
  const title = usePipelineStore((s) => s.title);
  const setTitle = usePipelineStore((s) => s.setTitle);
  const running = usePipelineStore((s) => s.running);
  const setFocusArea = usePipelineStore((s) => s.setFocusArea);

  const [pendingSample, setPendingSample] = useState<SampleSpec | null>(null);
  useEscapeDismiss(() => setPendingSample(null));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stripId = useId();

  const activeSample = matchSample(spec);
  const custom = isCustomSpec(spec);
  const trimmed = spec.trim().length;
  const remaining = Math.max(0, MIN_SPEC_CHARS - trimmed);
  const valid = remaining === 0;

  // Warn before the tab closes while a run is in flight or an unsaved custom spec is present.
  const protectInput = running || custom;
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

  const chooseSample = (sample: SampleSpec) => {
    if (activeSample?.id === sample.id) return;
    if (custom) {
      setPendingSample(sample);
      return;
    }
    loadSample(sample);
  };

  return (
    <Panel
      id={SPEC_PANEL_ID}
      title="Spec"
      icon={<FileText size={14} />}
      actions={
        activeSample ? (
          <Badge tone="cyan" title="A bundled sample spec is loaded">
            Sample
          </Badge>
        ) : custom ? (
          <Badge tone="emerald" title="Your own specification">
            Your spec
          </Badge>
        ) : null
      }
    >
      <div className="space-y-3">
        <div role="group" aria-label="Load a sample spec" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <Sparkles size={13} className="text-emerald-300" aria-hidden />
            Try a sample
          </span>
          {SAMPLE_SPECS.map((sample) => {
            const active = activeSample?.id === sample.id;
            return (
              <button
                key={sample.id}
                type="button"
                aria-pressed={active}
                disabled={running}
                onClick={() => chooseSample(sample)}
                title={`Load the ${sample.title} spec`}
                className={clsx(
                  "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-40",
                  active
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                    : "border-edge-strong text-fg-muted hover:border-emerald-500/40 hover:text-fg",
                )}
              >
                {sample.label}
              </button>
            );
          })}
        </div>

        {pendingSample && (
          <InlineConfirm
            question={`Replace your spec with the ${pendingSample.label} sample?`}
            confirmLabel="Replace"
            onConfirm={() => {
              loadSample(pendingSample);
              setPendingSample(null);
            }}
            onCancel={() => setPendingSample(null)}
          />
        )}

        <textarea
          ref={textareaRef}
          id={SPEC_INPUT_ID}
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          onFocus={() => setFocusArea("editor")}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          aria-label="Product specification"
          aria-describedby={stripId}
          className="field min-h-[320px] resize-y font-mono text-[12.5px] leading-relaxed lg:min-h-[400px]"
        />

        <p id={stripId} className="tabular flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-fg-dim">
          <span>
            {formatNumber(spec.length)} characters · {formatNumber(countLines(spec))} lines
          </span>
          {valid ? (
            <span className="text-emerald-300">Ready to generate</span>
          ) : (
            <span className="text-amber-300">
              {formatNumber(remaining)} more character{remaining === 1 ? "" : "s"} needed
            </span>
          )}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs text-fg-muted">Run title (optional)</span>
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
