import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import type { TelemetryStep } from "@shared/types.js";
import { formatDuration, formatNumber, formatSeconds, formatTokens } from "../../lib/format.ts";
import { Badge } from "../ui/Badge.tsx";

export type StepStatus = TelemetryStep["status"];

/** Current epoch ms, refreshed every `intervalMs` while `active`. Static (no timer) otherwise. */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

export interface StepMetrics {
  elapsed: string;
  tokens: string;
  throughput: string;
  prompt: string;
}

/**
 * Honest metric strings for a step.
 *  - Elapsed: live only while running (real API-side `startedAt`); `durationMs` once finished; "—" when pending.
 *  - Tokens: streamed estimates are marked "≈ … est."; final numbers are Ollama's reported usage; 0/0 → "— (no usage)".
 *  - Throughput: never for fallback steps (no model call); live estimate or finished average.
 */
export function stepMetrics(step: TelemetryStep, now: number): StepMetrics {
  const running = step.status === "running";
  const finished = step.status === "success" || step.status === "fallback" || step.status === "error";
  const isFallback = step.status === "fallback" || step.mode === "fallback";
  const reported = step.inputTokens > 0 || step.outputTokens > 0;
  const duration = step.durationMs ?? 0;

  let elapsed = "—";
  if (running) elapsed = formatSeconds(Math.max(0, now - step.startedAt));
  else if (finished) elapsed = formatDuration(step.durationMs);

  let tokens = "—";
  if (running && step.progress) tokens = `≈ ${formatTokens(step.progress.outputTokens)} out · est.`;
  else if (finished && reported) tokens = `in ${formatTokens(step.inputTokens)} · out ${formatTokens(step.outputTokens)}`;
  else if (step.status === "success" || step.status === "fallback") tokens = "— (no usage)";

  let throughput = "—";
  if (!isFallback) {
    if (running && step.progress) throughput = `≈ ${formatNumber(step.progress.tokensPerSecond, 1)} tok/s · est.`;
    else if (finished && step.outputTokens > 0 && duration > 0)
      throughput = `${formatNumber(step.outputTokens / (duration / 1000), 1)} tok/s · avg`;
  }

  const prompt = step.promptChars > 0 ? `${formatNumber(step.promptChars)} chars` : "—";
  return { elapsed, tokens, throughput, prompt };
}

const NODE_TONE: Record<StepStatus, string> = {
  pending: "border-edge opacity-60",
  running: "border-violet-500/40 shadow-glow-violet",
  success: "border-emerald-500/30",
  fallback: "border-amber-500/30",
  error: "border-red-500/30",
};

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: "queued",
  running: "running",
  success: "succeeded",
  fallback: "completed via deterministic fallback",
  error: "failed",
};

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "running":
      return <Loader2 size={15} className="animate-spin text-violet-300" aria-hidden />;
    case "success":
      return <CheckCircle2 size={15} className="text-emerald-400" aria-hidden />;
    case "fallback":
      return <CheckCircle2 size={15} className="text-amber-300" aria-hidden />;
    case "error":
      return <XCircle size={15} className="text-red-400" aria-hidden />;
    default:
      return <Circle size={15} className="text-fg-faint" aria-hidden />;
  }
}

function Metric({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-2xs uppercase tracking-wider text-fg-dim">{label}</dt>
      <dd className={clsx("tabular truncate font-mono text-[11px] leading-4", live ? "text-violet-200" : "text-fg-muted")} title={value}>
        {value}
      </dd>
    </div>
  );
}

export interface AgentStepCardProps {
  step: TelemetryStep;
  /** Zero-based position in the pipeline; rendered as "01", "02", "03". */
  index: number;
  className?: string;
}

/**
 * One pipeline node. Every slot (badge row, 2×2 metrics, message line) is always rendered at a fixed
 * height so the node never changes size across pending → running → finished transitions.
 */
export function AgentStepCard({ step, index, className }: AgentStepCardProps) {
  const running = step.status === "running";
  const pending = step.status === "pending";
  const now = useNow(running);
  const m = stepMetrics(step, now);

  const message = step.error
    ? step.status === "fallback"
      ? `fallback reason: ${step.error}`
      : step.status === "error"
        ? `error: ${step.error}`
        : null
    : null;

  return (
    <div
      role="group"
      aria-label={`${step.agentName}: ${STATUS_LABEL[step.status]}`}
      data-status={step.status}
      className={clsx(
        "flex min-w-0 flex-col gap-2 rounded-panel border bg-surface-2 p-3 transition-[border-color,box-shadow,opacity] duration-200 ease-out-soft",
        NODE_TONE[step.status],
        className
      )}
    >
      <div className="flex min-h-[18px] items-center gap-1.5">
        <span className="flex w-[15px] shrink-0 items-center justify-center">
          <StatusIcon status={step.status} />
        </span>
        <span className="tabular shrink-0 font-mono text-2xs text-fg-dim">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0 truncate text-13 font-semibold text-fg" title={step.agentName}>
          {step.agentName}
        </span>
      </div>

      <div className="flex h-[18px] min-w-0 items-center gap-1">
        {!pending && (
          <Badge tone={step.mode === "gemma" ? "emerald" : "amber"} mono size="xs" className="shrink-0">
            {step.mode === "gemma" ? "GEMMA" : "FALLBACK"}
          </Badge>
        )}
        {!pending && step.codegenStrategy && (
          <Badge tone="cyan" mono size="xs" className="min-w-0" title={`codegen strategy: ${step.codegenStrategy}`}>
            {step.codegenStrategy}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Metric label="Elapsed" value={m.elapsed} live={running} />
        <Metric label="Tokens" value={m.tokens} live={running && !!step.progress} />
        <Metric label="Throughput" value={m.throughput} live={running && !!step.progress} />
        <Metric label="Prompt" value={m.prompt} />
      </dl>

      <p
        className={clsx("h-4 min-w-0 truncate text-[11px] leading-4", step.status === "error" ? "text-red-300" : "text-amber-300/90")}
        title={message ?? undefined}
      >
        {message ?? " "}
      </p>
    </div>
  );
}
