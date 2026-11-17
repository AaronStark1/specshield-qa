import { useEffect, useState } from "react";
import { AlertTriangle, Eraser, Play, Square } from "lucide-react";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { MIN_SPEC_CHARS, usePipeline } from "../../hooks/usePipeline.ts";
import { getModifierLabel } from "../../hooks/useCommandShortcuts.ts";
import { matchSample } from "../../lib/samples.ts";
import { Button } from "../ui/Button.tsx";
import { Kbd } from "../ui/Kbd.tsx";

/** Clears both the spec and the run title. */
export function clearSpec(): void {
  const store = usePipelineStore.getState();
  store.setSpec("");
  store.setTitle("");
}

/** True when the editor holds text the user wrote themselves (not empty, not a bundled sample). */
export function isCustomSpec(spec: string): boolean {
  return spec.trim().length > 0 && matchSample(spec) === null;
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

/** Generate / Cancel / Clear. The global ⌘/Ctrl+Enter handler lives in `useCommandShortcuts`; this only renders the hint. */
export function RunControls() {
  const spec = usePipelineStore((s) => s.spec);
  const title = usePipelineStore((s) => s.title);
  const running = usePipelineStore((s) => s.running);
  const { run, cancel } = usePipeline();
  const [confirmClear, setConfirmClear] = useState(false);
  useEscapeDismiss(() => setConfirmClear(false));
  const modifier = getModifierLabel();

  const remaining = Math.max(0, MIN_SPEC_CHARS - spec.trim().length);
  const valid = remaining === 0;
  const nothingToClear = spec.trim().length === 0 && title.length === 0;

  const runTitle = running
    ? "Generation is in progress"
    : valid
      ? `${modifier}+Enter`
      : `Add ${remaining.toLocaleString("en-US")} more character${remaining === 1 ? "" : "s"} to the spec`;

  const onClear = () => {
    if (isCustomSpec(spec)) {
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
          aria-label={running ? "Generating test suite" : "Generate test suite"}
        >
          {running ? (
            "Generating…"
          ) : (
            <>
              Generate Test Suite
              <Kbd size="xs" className="ml-1">{modifier}↵</Kbd>
            </>
          )}
        </Button>
        {running && (
          <Button variant="danger" icon={<Square size={15} />} onClick={cancel} title="Stop the current run">
            Cancel
          </Button>
        )}
        <Button
          variant="secondary"
          icon={<Eraser size={15} />}
          disabled={running || nothingToClear || confirmClear}
          onClick={onClear}
          title={running ? "Wait for the run to finish" : nothingToClear ? "Nothing to clear" : "Clear the spec and title"}
        >
          Clear
        </Button>
      </div>
      {confirmClear && (
        <InlineConfirm
          question="Clear your spec?"
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
