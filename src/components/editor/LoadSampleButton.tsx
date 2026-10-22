import { useEffect, useState } from "react";
import { AlertTriangle, Eraser, FileUp, Play, Square } from "lucide-react";
import { SAMPLE_SPEC, SAMPLE_SPEC_TITLE } from "@shared/sampleSpec.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { MIN_SPEC_CHARS, usePipeline } from "../../hooks/usePipeline.ts";
import { Button } from "../ui/Button.tsx";
import { Kbd } from "../ui/Kbd.tsx";

/** Platform modifier label for the run shortcut (⌘↵ on Apple platforms, Ctrl↵ elsewhere). Computed once. */
export const MOD_KEY =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";

export type SpecSource = "sample" | "custom" | "empty";

/** Where the editor text came from: the bundled sample, the user, or nothing (whitespace counts as nothing). */
export function specSource(spec: string): SpecSource {
  if (spec === SAMPLE_SPEC) return "sample";
  return spec.trim().length === 0 ? "empty" : "custom";
}

/** Loads the bundled Invoice Tracker PRD and its title into the store. */
export function loadSampleSpec(): void {
  const st = usePipelineStore.getState();
  st.setSpec(SAMPLE_SPEC);
  st.setTitle(SAMPLE_SPEC_TITLE);
}

/** Clears both the spec and the run title. */
export function clearSpec(): void {
  const st = usePipelineStore.getState();
  st.setSpec("");
  st.setTitle("");
}

/**
 * Calls `dismiss` whenever the global Esc handler bumps `escapeTick`.
 * Used to auto-cancel two-step confirms; the handler is a no-op when nothing is open.
 */
export function useEscapeDismiss(dismiss: () => void): void {
  const escapeTick = usePipelineStore((s) => s.escapeTick);
  useEffect(() => {
    // Only react to Esc presses; `dismiss` is read from the render in which the tick changed.
    if (escapeTick > 0) dismiss();
  }, [escapeTick]);
}

export interface InlineConfirmProps {
  question: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Second step of a destructive action, rendered inline (no modal). Esc cancels via `useEscapeDismiss` in the parent. */
export function InlineConfirm({ question, onConfirm, onCancel, confirmLabel = "Confirm", cancelLabel = "Keep" }: InlineConfirmProps) {
  return (
    <div
      role="group"
      aria-label={question}
      className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-1.5 animate-fade-in"
    >
      <AlertTriangle size={13} className="shrink-0 text-amber-300" aria-hidden />
      <span className="text-xs text-amber-200">{question}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="danger" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Kbd size="xs" className="hidden sm:inline-flex">Esc</Kbd>
      </div>
    </div>
  );
}

/**
 * Standalone "load the sample PRD" button. `SpecEditor` has its own template selector in the Panel header,
 * so App only needs this when rendering the editor pieces separately.
 */
export function LoadSampleButton() {
  const spec = usePipelineStore((s) => s.spec);
  const running = usePipelineStore((s) => s.running);
  const [confirm, setConfirm] = useState(false);
  useEscapeDismiss(() => setConfirm(false));
  const source = specSource(spec);

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<FileUp size={13} />}
        disabled={running || source === "sample"}
        onClick={() => (source === "custom" ? setConfirm(true) : loadSampleSpec())}
        title={source === "sample" ? "Sample already loaded" : "Load the Invoice Tracker sample PRD"}
      >
        Load sample spec
      </Button>
      {confirm && (
        <InlineConfirm
          question="Replace custom spec with the sample?"
          onConfirm={() => {
            loadSampleSpec();
            setConfirm(false);
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

/** Run / Cancel / Clear. The global ⌘/Ctrl+Enter handler lives elsewhere; this only renders the hint. */
export function RunControls() {
  const spec = usePipelineStore((s) => s.spec);
  const title = usePipelineStore((s) => s.title);
  const running = usePipelineStore((s) => s.running);
  const { run, cancel } = usePipeline();
  const [confirmClear, setConfirmClear] = useState(false);
  useEscapeDismiss(() => setConfirmClear(false));

  const trimmed = spec.trim().length;
  const remaining = Math.max(0, MIN_SPEC_CHARS - trimmed);
  const valid = remaining === 0;
  const source = specSource(spec);
  const nothingToClear = source === "empty" && title.length === 0;

  const runTitle = running
    ? "Pipeline is running"
    : valid
      ? `${MOD_KEY}+Enter`
      : `Need ${remaining.toLocaleString("en-US")} more character${remaining === 1 ? "" : "s"}`;

  const onClear = () => {
    if (source === "custom") {
      setConfirmClear(true);
      return;
    }
    clearSpec();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          icon={<Play size={15} />}
          loading={running}
          disabled={!valid}
          onClick={() => void run()}
          className="min-w-0 flex-1"
          title={runTitle}
          aria-label={running ? "Running pipeline" : "Run pipeline"}
        >
          {running ? (
            "Running…"
          ) : (
            <>
              Run pipeline
              <Kbd size="xs" className="ml-1">{MOD_KEY}↵</Kbd>
            </>
          )}
        </Button>
        {running && (
          <Button variant="danger" icon={<Square size={15} />} onClick={cancel} title="Abort the current run">
            Cancel
          </Button>
        )}
        <Button
          variant="secondary"
          icon={<Eraser size={15} />}
          disabled={running || nothingToClear || confirmClear}
          onClick={onClear}
          title={running ? "Wait for the run to finish" : nothingToClear ? "Nothing to clear" : "Clear spec and title"}
        >
          Clear
        </Button>
      </div>
      {confirmClear && (
        <InlineConfirm
          question="Clear custom spec?"
          onConfirm={() => {
            clearSpec();
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
