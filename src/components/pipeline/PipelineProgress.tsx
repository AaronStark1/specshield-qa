import { Fragment } from "react";
import { clsx } from "clsx";
import { AlertTriangle, ArrowRight, Ban, Check, Loader2 } from "lucide-react";
import type { StepId, TelemetryStep } from "@shared/types.js";
import { useNow } from "../../hooks/useNow.ts";
import { formatDuration, formatSeconds } from "../../lib/format.ts";
import { totalDurationMs, wallClockMs } from "../../lib/runs.ts";

export interface PipelineProgressProps {
  steps: TelemetryStep[];
  /** True from the moment a run is requested, before the first step reports in. */
  running?: boolean;
  /** Epoch ms when the run was started from this page; falls back to the earliest step start. */
  runStartedAt?: number | null;
  /** Last run error; "Run cancelled" renders as a neutral notice rather than a failure. */
  error?: string | null;
  className?: string;
}

const STAGES: readonly { step: StepId; label: string }[] = [
  { step: "requirementParser", label: "Parsing Requirements" },
  { step: "qaMatrixArchitect", label: "Architecting Matrix" },
  { step: "playwrightCodegen", label: "Generating Code" },
];

type SegmentState = "idle" | "active" | "done" | "failed";

function segmentState(step: TelemetryStep | undefined): SegmentState {
  if (!step || step.status === "pending") return "idle";
  if (step.status === "running") return "active";
  if (step.status === "error") return "failed";
  return "done";
}

const SEGMENT: Record<SegmentState, string> = {
  idle: "border-edge bg-surface-2/60 text-fg-dim",
  active: "border-emerald-400/50 bg-emerald-500/[0.08] text-fg shadow-glow-emerald",
  done: "border-emerald-500/30 bg-emerald-500/[0.06] text-fg",
  failed: "border-red-500/40 bg-red-500/[0.07] text-red-200",
};

function SegmentMark({ state, index }: { state: SegmentState; index: number }) {
  if (state === "active") return <Loader2 size={14} className="animate-spin text-emerald-300" aria-hidden />;
  if (state === "done") return <Check size={14} strokeWidth={2.75} className="text-emerald-300" aria-hidden />;
  if (state === "failed") return <AlertTriangle size={14} className="text-red-300" aria-hidden />;
  return <span className="tabular font-mono text-[11px]">{index + 1}</span>;
}

const STATE_LABEL: Record<SegmentState, string> = { idle: "waiting", active: "in progress", done: "done", failed: "stopped" };

/** Three-segment run progress: Parsing Requirements → Architecting Matrix → Generating Code. */
export function PipelineProgress({ steps, running = false, runStartedAt = null, error = null, className }: PipelineProgressProps) {
  const byStep = new Map(steps.map((s) => [s.step, s] as const));
  const states = STAGES.map((stage) => segmentState(byStep.get(stage.step)));
  const live = running || states.includes("active");
  const now = useNow(live);

  const started = steps.filter((s) => s.status !== "pending").map((s) => s.startedAt);
  const startAt = runStartedAt ?? (started.length > 0 ? Math.min(...started) : null);
  const complete = !live && steps.length > 0 && states.every((s) => s === "done");
  const cancelled = error === "Run cancelled";
  const failed = !live && !complete && (states.includes("failed") || (error !== null && !cancelled));
  const duration = wallClockMs(steps) ?? totalDurationMs(steps);

  let chip: { text: string; tone: string };
  if (live) {
    chip = { text: `Running · ${startAt != null ? formatSeconds(Math.max(0, now - startAt)) : "0.0s"}`, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" };
  } else if (complete) {
    chip = { text: `Completed in ${formatDuration(duration)}`, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  } else if (cancelled) {
    chip = { text: "Cancelled", tone: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  } else if (failed) {
    chip = { text: "Stopped", tone: "border-red-500/30 bg-red-500/10 text-red-300" };
  } else {
    chip = { text: "Ready", tone: "border-white/10 bg-white/[0.04] text-fg-muted" };
  }

  return (
    <section className={clsx("panel min-w-0 p-4", className)} aria-label="Run progress">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-13 font-semibold tracking-tight text-fg">Progress</h2>
        <span role="status" className={clsx("tabular inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", chip.tone)}>
          {complete && <Check size={12} strokeWidth={2.75} aria-hidden />}
          {chip.text}
        </span>
      </div>

      <ol className="mt-3 grid grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        {STAGES.map((stage, i) => {
          const state = states[i]!;
          const step = byStep.get(stage.step);
          return (
            <Fragment key={stage.step}>
              {i > 0 && (
                <li aria-hidden className="hidden items-center md:flex">
                  <ArrowRight size={14} className={states[i - 1] === "done" ? "text-emerald-400" : "text-fg-faint"} />
                </li>
              )}
              <li
                aria-current={state === "active" ? "step" : undefined}
                aria-label={`Step ${i + 1}, ${stage.label}: ${STATE_LABEL[state]}`}
                className={clsx(
                  "flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-200 ease-out-soft",
                  SEGMENT[state],
                )}
              >
                <span
                  className={clsx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    state === "idle" ? "border-edge-strong" : state === "failed" ? "border-red-500/40" : "border-emerald-400/40 bg-emerald-500/10",
                  )}
                >
                  <SegmentMark state={state} index={i} />
                </span>
                <span className="min-w-0 flex-1 truncate text-13 font-medium">
                  {i + 1}. {stage.label}
                </span>
                {state === "done" && step?.durationMs != null && step.durationMs >= 100 && (
                  <span className="tabular shrink-0 font-mono text-[11px] text-fg-dim">{formatDuration(step.durationMs)}</span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>

      {error && (
        <div
          role="alert"
          className={clsx(
            "mt-3 flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed",
            cancelled ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-red-500/30 bg-red-500/10 text-red-200",
          )}
        >
          {cancelled ? <Ban size={13} className="mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />}
          <span className="min-w-0 break-words">{cancelled ? "Run cancelled. Your spec is untouched." : `The run stopped: ${error}`}</span>
        </div>
      )}
    </section>
  );
}
