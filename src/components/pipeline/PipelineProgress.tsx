import { clsx } from "clsx";
import { AlertTriangle, ArrowRight, Ban, Workflow } from "lucide-react";
import type { StepId, TelemetryStep } from "@shared/types.js";
import { formatDuration, formatSeconds, formatTokens } from "../../lib/format.ts";
import { modeTone, runOutcome, tokenTotals, totalDurationMs, type RunOutcome } from "../../lib/runs.ts";
import { Badge, type BadgeTone } from "../ui/Badge.tsx";
import { Panel } from "../ui/Panel.tsx";
import { AgentStepCard, useNow } from "./AgentStepCard.tsx";

// Backward-compatible re-export: older code imports AgentStepCard from this module.
export { AgentStepCard } from "./AgentStepCard.tsx";

export interface PipelineProgressProps {
  steps: TelemetryStep[];
  /** `usePipelineStore().running` — keeps the panel in the live state while the first step:start is in flight. */
  running?: boolean;
  /** `usePipelineStore().runStartedAt` — UI-side epoch ms; falls back to the earliest step `startedAt`. */
  runStartedAt?: number | null;
  /** `usePipelineStore().lastError` — "Run cancelled" renders amber, anything else red. */
  error?: string | null;
  className?: string;
}

const STAGES = [
  { step: "requirementParser", agentName: "Requirement Parser" },
  { step: "qaMatrixArchitect", agentName: "QA Matrix Architect" },
  { step: "playwrightCodegen", agentName: "Playwright Codegen" },
] as const satisfies readonly { step: StepId; agentName: string }[];

function idleStep(stage: { step: StepId; agentName: string }): TelemetryStep {
  return {
    step: stage.step,
    agentName: stage.agentName,
    status: "pending",
    mode: "fallback",
    startedAt: 0,
    model: "",
    promptChars: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

/** Always three nodes in canonical order; stages missing from `steps` render as idle placeholders. */
function canonical(steps: TelemetryStep[]): [TelemetryStep, TelemetryStep, TelemetryStep] {
  const pick = (stage: { step: StepId; agentName: string }) => steps.find((s) => s.step === stage.step) ?? idleStep(stage);
  return [pick(STAGES[0]), pick(STAGES[1]), pick(STAGES[2])];
}

type ConnectorState = "pending" | "done" | "active" | "error";

function connectorState(left: TelemetryStep, right: TelemetryStep): ConnectorState {
  if (left.status === "error") return "error";
  const leftDone = left.status === "success" || left.status === "fallback";
  if (leftDone && right.status === "running") return "active";
  if (leftDone) return "done";
  return "pending";
}

const H_LINE: Record<ConnectorState, string> = {
  pending: "h-0 border-t border-dashed border-edge-strong",
  done: "h-px bg-emerald-500/60",
  active: "beam-track h-px bg-violet-500/40 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
  error: "h-px bg-red-500/50",
};

const V_LINE: Record<ConnectorState, string> = {
  pending: "w-0 border-l border-dashed border-edge-strong",
  done: "w-px bg-emerald-500/60",
  active: "w-px animate-status-pulse bg-violet-400/70",
  error: "w-px bg-red-500/50",
};

const ARROW: Record<ConnectorState, string> = {
  pending: "text-fg-faint",
  done: "text-emerald-400",
  active: "text-violet-300",
  error: "text-red-400",
};

/** Horizontal line + arrow on ≥ md; short vertical line + rotated arrow below. Purely decorative. */
function Connector({ state }: { state: ConnectorState }) {
  return (
    <div aria-hidden data-state={state} className="flex items-center justify-center md:h-full md:w-8">
      <div className="hidden w-full items-center md:flex">
        <span className={clsx("min-w-0 flex-1", H_LINE[state])} />
        <ArrowRight size={12} strokeWidth={2} className={clsx("-ml-px shrink-0", ARROW[state])} />
      </div>
      <div className="flex h-6 flex-col items-center md:hidden">
        <span className={clsx("flex-1", V_LINE[state])} />
        <ArrowRight size={12} strokeWidth={2} className={clsx("-mt-px shrink-0 rotate-90", ARROW[state])} />
      </div>
    </div>
  );
}

const OUTCOME: Record<RunOutcome, { tone: BadgeTone; text: string; dot: boolean | "pulse" }> = {
  pending: { tone: "gray", text: "IDLE", dot: false },
  running: { tone: "violet", text: "RUNNING", dot: "pulse" },
  success: { tone: "emerald", text: "SUCCESS", dot: true },
  fallback: { tone: "amber", text: "FALLBACK", dot: true },
  mixed: { tone: "violet", text: "MIXED", dot: true },
  error: { tone: "red", text: "ERROR", dot: true },
};

export function PipelineProgress({ steps, running = false, runStartedAt = null, error = null, className }: PipelineProgressProps) {
  const idle = steps.length === 0;
  const [n1, n2, n3] = canonical(steps);
  const outcome: RunOutcome = idle ? "pending" : runOutcome(steps);
  const live = running || outcome === "running";
  const now = useNow(live);

  // Live elapsed: UI-side run start, else the earliest real (non-placeholder) step start.
  const startedAts = steps.filter((s) => s.status !== "pending").map((s) => s.startedAt);
  const startAt = runStartedAt ?? (startedAts.length > 0 ? Math.min(...startedAts) : null);
  const liveElapsed = live && startAt != null ? Math.max(0, now - startAt) : null;
  const total = idle ? null : totalDurationMs(steps);
  const durationLabel = live ? "Elapsed" : "Total";
  const durationValue = live ? (liveElapsed != null ? formatSeconds(liveElapsed) : "—") : formatDuration(total);

  // Mode + model become known at pipeline:start (model is set on every step, even pending ones).
  const modes = new Set(steps.filter((s) => s.model || s.status !== "pending").map((s) => s.mode));
  const modeLabel = modes.size === 0 ? null : modes.size > 1 ? "mixed" : (modes.values().next().value ?? null);
  const model = steps.find((s) => s.model)?.model ?? null;

  const badge = live ? OUTCOME.running : OUTCOME[outcome];
  const cancelled = error === "Run cancelled";

  const totals = tokenTotals(steps);
  const footer = idle
    ? "Run the pipeline to populate"
    : live
      ? "Streaming over SSE · values marked est. are streamed estimates"
      : totals.reported
        ? `Σ tokens · in ${formatTokens(totals.input)} · out ${formatTokens(totals.output)}`
        : "No token usage reported";

  return (
    <Panel
      className={className}
      icon={<Workflow size={14} aria-hidden />}
      title="Agent pipeline"
      subtitle="Mastra · 3 steps"
      actions={
        <>
          <span className="hidden items-center gap-1.5 sm:inline-flex" title="Inference mode · model">
            {modeLabel ? (
              <Badge tone={modeTone(modeLabel)} mono size="xs">
                {modeLabel}
              </Badge>
            ) : (
              <Badge tone="gray" mono size="xs">
                mode —
              </Badge>
            )}
            {model && <span className="font-mono text-2xs text-fg-muted">{model}</span>}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-2xs" title={live ? "Elapsed since the run started" : "Sum of step durations"}>
            <span className="uppercase tracking-wider text-fg-dim">{durationLabel}</span>
            <span className={clsx("tabular", live ? "text-violet-200" : "text-fg-muted")}>{durationValue}</span>
          </span>
          <Badge tone={badge.tone} mono dot={badge.dot} label={`Pipeline status: ${badge.text}`}>
            {badge.text}
          </Badge>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-1.5">
        <AgentStepCard step={n1} index={0} />
        <Connector state={connectorState(n1, n2)} />
        <AgentStepCard step={n2} index={1} />
        <Connector state={connectorState(n2, n3)} />
        <AgentStepCard step={n3} index={2} />
      </div>

      <p className="mt-3 h-4 truncate font-mono text-2xs uppercase tracking-wider text-fg-dim" title={footer}>
        {footer}
      </p>

      {error && (
        <div
          role="alert"
          className={clsx(
            "mt-3 flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed",
            cancelled ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-red-500/30 bg-red-500/10 text-red-200"
          )}
        >
          {cancelled ? <Ban size={13} className="mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />}
          <span className="min-w-0 break-words">{cancelled ? "Run cancelled" : `Pipeline error: ${error}`}</span>
        </div>
      )}
    </Panel>
  );
}
