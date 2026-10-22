import { useEffect, useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { Activity, Check, ChevronRight, Copy, ExternalLink, Info } from "lucide-react";
import type { TelemetryStep } from "@shared/types.js";
import { formatDateTime, formatDuration, formatNumber, formatSeconds, formatTokens } from "../../lib/format.ts";
import { copyText } from "../../lib/clipboard.ts";
import { modeTone, outcomeTone, runOutcome, tokenTotals, totalDurationMs, wallClockMs } from "../../lib/runs.ts";
import { useHealth } from "../../hooks/useHealth.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { Badge, type BadgeTone } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";

export interface TelemetryDrawerProps {
  steps: TelemetryStep[];
  /** Pipeline-level Sentry trace id. Falls back to the first step that carries one. */
  traceId?: string;
  /** True while the pipeline is streaming; keeps the time axis live. */
  running?: boolean;
  /** Epoch ms when the current run was started from this UI (store.runStartedAt). */
  runStartedAt?: number | null;
}

const TICKS = [0, 0.25, 0.5, 0.75, 1] as const;
const MIN_BAR_PCT = 0.4;
const TINY_RUN_MS = 10;

function statusTone(s: TelemetryStep["status"]): BadgeTone {
  switch (s) {
    case "success":
      return "emerald";
    case "fallback":
      return "amber";
    case "running":
      return "violet";
    case "error":
      return "red";
    default:
      return "gray";
  }
}

const barColour: Record<TelemetryStep["status"], string> = {
  success: "bg-emerald-500/70",
  fallback: "bg-amber-500/70",
  running: "bg-gradient-to-r from-violet-500/70 via-violet-300/80 to-violet-500/70 bg-[length:200%_100%] animate-shimmer",
  error: "bg-red-500/70",
  pending: "",
};

/** Epoch ms → formatted local date-time; "—" for anything that is not a real timestamp. */
function stamp(ms: number | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "—" : formatDateTime(d.toISOString());
}

/** Re-renders every `intervalMs` while `active`; frozen otherwise. */
function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

type RowKind = "bar" | "pending" | "incomplete";
interface RowTiming {
  kind: RowKind;
  leftPct: number;
  widthPct: number;
  /** Real or live duration in ms; null when it cannot be known without guessing. */
  durationMs: number | null;
  live: boolean;
}
interface Timeline {
  t0: number | null;
  span: number;
  anyRunning: boolean;
  incomplete: boolean;
  tinyFallback: boolean;
  rows: RowTiming[];
}

function buildTimeline(steps: TelemetryStep[], now: number): Timeline {
  const started = steps.filter((s) => s.status !== "pending" && Number.isFinite(s.startedAt));
  const anyRunning = steps.some((s) => s.status === "running");
  const t0 = started.length > 0 ? Math.min(...started.map((s) => s.startedAt)) : null;

  // Known end for a finished step: real endedAt, else startedAt + real durationMs. Never estimated.
  const endOf = (s: TelemetryStep): number | null =>
    typeof s.endedAt === "number" ? s.endedAt : typeof s.durationMs === "number" ? s.startedAt + s.durationMs : null;

  let tEnd = t0 ?? 0;
  if (t0 != null) {
    for (const s of started) {
      const e = s.status === "running" ? now : endOf(s);
      if (e != null && e > tEnd) tEnd = e;
    }
  }
  const span = Math.max(1, tEnd - (t0 ?? 0));

  let incomplete = false;
  let finishedTotal = 0;
  let finishedCount = 0;
  const rows: RowTiming[] = steps.map((s) => {
    if (s.status === "pending" || t0 == null) return { kind: "pending", leftPct: 0, widthPct: 0, durationMs: null, live: false };
    const leftPct = Math.min(99.6, Math.max(0, ((s.startedAt - t0) / span) * 100));
    if (s.status === "running") {
      const dur = Math.max(0, now - s.startedAt);
      const widthPct = Math.min(100 - leftPct, Math.max(MIN_BAR_PCT, (dur / span) * 100));
      return { kind: "bar", leftPct, widthPct, durationMs: dur, live: true };
    }
    const end = endOf(s);
    if (end == null) {
      incomplete = true;
      return { kind: "incomplete", leftPct, widthPct: 0, durationMs: null, live: false };
    }
    const dur = typeof s.durationMs === "number" ? s.durationMs : Math.max(0, end - s.startedAt);
    finishedTotal += dur;
    finishedCount += 1;
    const widthPct = Math.min(100 - leftPct, Math.max(MIN_BAR_PCT, (Math.max(0, end - s.startedAt) / span) * 100));
    return { kind: "bar", leftPct, widthPct, durationMs: dur, live: false };
  });

  const tinyFallback = !anyRunning && !incomplete && finishedCount > 0 && finishedCount === started.length && finishedTotal < TINY_RUN_MS;
  return { t0, span, anyRunning, incomplete, tinyFallback, rows };
}

function Stat({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5" title={title}>
      <dt className="shrink-0 uppercase tracking-wider text-fg-dim">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-fg">{children}</dd>
    </div>
  );
}

function Detail({ label, value, wide, className }: { label: string; value: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className="contents">
      <dt className="text-fg-dim">{label}</dt>
      <dd className={clsx("min-w-0 break-all text-fg", wide && "sm:col-span-3", className)}>{value}</dd>
    </div>
  );
}

function StepRow({ step: s, timing, expanded, onToggle }: { step: TelemetryStep; timing: RowTiming; expanded: boolean; onToggle: () => void }) {
  const detailsId = `telemetry-step-${s.step}`;
  const tokensKnown = s.inputTokens > 0 || s.outputTokens > 0;
  const liveTps = s.status === "running" && s.progress && s.progress.tokensPerSecond > 0 ? s.progress.tokensPerSecond : null;

  return (
    <div
      role="listitem"
      className="grid grid-cols-1 gap-x-3 gap-y-1 py-2 md:grid-cols-[180px_minmax(0,1fr)_150px] md:items-center"
    >
      {/* label */}
      <div className="min-w-0">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={onToggle}
          className="flex min-w-0 max-w-full items-center gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          <ChevronRight size={12} aria-hidden className={clsx("shrink-0 text-fg-dim transition-transform duration-150", expanded && "rotate-90")} />
          <span className="truncate text-xs font-medium text-fg">{s.agentName}</span>
        </button>
        <div className="mt-0.5 flex flex-wrap gap-1 pl-4">
          <Badge tone={statusTone(s.status)} mono size="xs" dot={s.status === "running" ? "pulse" : s.status !== "pending"} label={`Status: ${s.status}`}>
            {s.status}
          </Badge>
          {s.status !== "fallback" && (
            <Badge tone={modeTone(s.mode)} mono size="xs" label={`Mode: ${s.mode}`}>
              {s.mode}
            </Badge>
          )}
          {s.codegenStrategy && (
            <Badge tone="sky" size="xs" title={`Codegen strategy: ${s.codegenStrategy}`}>
              {s.codegenStrategy}
            </Badge>
          )}
        </div>
      </div>

      {/* track */}
      <div
        aria-hidden
        className={clsx(
          "relative h-4 w-full overflow-hidden rounded",
          timing.kind === "pending" ? "border border-dashed border-edge-strong" : "bg-black/30"
        )}
      >
        {timing.kind !== "pending" &&
          [0.25, 0.5, 0.75].map((p) => <span key={p} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: `${p * 100}%` }} />)}
        {timing.kind === "bar" && (
          <span
            className={clsx("absolute inset-y-0.5 rounded-[3px]", barColour[s.status], timing.live && "shadow-glow-violet")}
            style={{ left: `${timing.leftPct}%`, width: `${timing.widthPct}%` }}
          />
        )}
        {timing.kind === "incomplete" && <span className="absolute inset-y-0 w-px bg-amber-400/80" style={{ left: `${timing.leftPct}%` }} />}
        {timing.kind === "pending" && (
          <span className="absolute inset-0 flex items-center px-1.5 font-mono text-2xs text-fg-faint">not started</span>
        )}
      </div>

      {/* metrics */}
      <div className="tabular pl-4 font-mono text-2xs leading-4 text-fg-muted md:pl-0 md:text-right">
        <div className={clsx(timing.live ? "text-violet-300" : timing.kind === "incomplete" ? "text-amber-300" : "text-fg")}>
          {timing.kind === "pending" ? "—" : timing.kind === "incomplete" ? "timing incomplete" : formatDuration(timing.durationMs)}
          {timing.live && <span className="ml-1 text-violet-300/70">live</span>}
        </div>
        <div>
          {s.status === "running" ? (
            s.progress ? (
              <>
                out ~{formatTokens(s.progress.outputTokens)}
                {liveTps != null && <span className="text-fg-dim"> · {liveTps.toFixed(1)} tok/s est.</span>}
              </>
            ) : (
              "tokens —"
            )
          ) : tokensKnown ? (
            <>
              in {formatTokens(s.inputTokens)} · out {formatTokens(s.outputTokens)}
            </>
          ) : (
            <span title="No token usage reported for this step">tokens —</span>
          )}
        </div>
        <div className="text-fg-dim">{formatNumber(s.promptChars)} chars</div>
      </div>

      {/* details */}
      {expanded && (
        <div id={detailsId} className="col-span-full animate-fade-in rounded-md border border-edge bg-black/20 px-3 py-2">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-2xs sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Detail label="started" value={s.status === "pending" ? "— (not started)" : stamp(s.startedAt)} />
            <Detail label="ended" value={stamp(s.endedAt)} />
            <Detail label="durationMs" value={typeof s.durationMs === "number" ? `${s.durationMs} ms` : "—"} />
            <Detail label="model" value={s.model || "—"} />
            <Detail label="tokens" value={tokensKnown ? `in ${formatTokens(s.inputTokens)} / out ${formatTokens(s.outputTokens)}` : "not reported"} />
            <Detail
              label="live est."
              value={
                s.progress
                  ? `${formatTokens(s.progress.outputTokens)} out · ${s.progress.tokensPerSecond.toFixed(1)} tok/s (chars ÷ 4 over elapsed)`
                  : "—"
              }
            />
            <Detail label="trace" value={s.sentryTraceId ?? "—"} />
            <Detail label="span" value={s.sentrySpanId ?? "—"} />
            <Detail label="strategy" value={s.codegenStrategy ?? "—"} />
            <Detail label="step" value={s.step} />
            {s.error && <Detail label="error" wide className="whitespace-pre-wrap text-red-300" value={s.error} />}
          </dl>
        </div>
      )}
    </div>
  );
}

export function TelemetryDrawer({ steps, traceId, running = false, runStartedAt = null }: TelemetryDrawerProps) {
  const { health } = useHealth();
  const escapeTick = usePipelineStore((s) => s.escapeTick);
  const anyRunning = steps.some((s) => s.status === "running");
  const now = useNow(running || anyRunning);
  const timeline = useMemo(() => buildTimeline(steps, now), [steps, now]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setExpanded((prev) => (prev.size ? new Set() : prev));
  }, [escapeTick]);

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copyState === "idle") return;
    const id = setTimeout(() => setCopyState("idle"), 1800);
    return () => clearTimeout(id);
  }, [copyState]);

  if (steps.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={16} aria-hidden />}
        title="No telemetry yet"
        hint="Run the pipeline to see a per-agent waterfall. Spans are recorded in-process by the API even when no Sentry DSN is set."
      />
    );
  }

  const outcome = runOutcome(steps);
  const wall = wallClockMs(steps);
  const sum = totalDurationMs(steps);
  const elapsed = running && runStartedAt != null ? Math.max(0, now - runStartedAt) : null;
  const tokens = tokenTotals(steps);
  const promptChars = steps.reduce((acc, s) => acc + (Number.isFinite(s.promptChars) ? s.promptChars : 0), 0);
  const modes = new Set(steps.map((s) => s.mode));
  const mode = modes.size === 1 ? [...modes][0]! : "mixed";
  const models = [...new Set(steps.map((s) => s.model).filter(Boolean))];

  const effectiveTraceId = traceId || steps.find((s) => s.sentryTraceId)?.sentryTraceId || null;
  const template = health?.sentryTraceUrlTemplate;
  const sentryHref =
    effectiveTraceId && typeof template === "string" && template.includes("{traceId}")
      ? template.replaceAll("{traceId}", encodeURIComponent(effectiveTraceId))
      : null;
  const sentryHrefSafe = sentryHref && /^https?:\/\//i.test(sentryHref) ? sentryHref : null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copyTrace = async () => {
    if (!effectiveTraceId) return;
    setCopyState((await copyText(effectiveTraceId)) ? "copied" : "failed");
  };

  return (
    <div className="min-w-0">
      {/* Summary strip */}
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge pb-3 font-mono text-2xs text-fg-muted">
        <Stat label="outcome">
          <Badge tone={outcomeTone(outcome)} mono size="xs" dot={outcome === "running" ? "pulse" : outcome !== "pending"}>
            {outcome}
          </Badge>
        </Stat>
        <Stat label="duration" title="wall = first start → last end · sum = per-step durations added up">
          {wall != null ? (
            <>
              <span className="tabular">{formatDuration(wall)}</span>
              <span className="text-fg-dim">wall</span>
            </>
          ) : sum != null ? (
            <>
              <span className="tabular">{formatDuration(sum)}</span>
              <span className="text-fg-dim">sum{anyRunning || running ? " · partial" : ""}</span>
            </>
          ) : elapsed != null ? (
            <>
              <span className="tabular text-violet-300">{formatSeconds(elapsed)}</span>
              <span className="text-fg-dim">elapsed</span>
            </>
          ) : (
            <span>—</span>
          )}
        </Stat>
        {elapsed != null && (wall != null || sum != null) && (
          <Stat label="elapsed">
            <span className="tabular text-violet-300">{formatSeconds(elapsed)}</span>
          </Stat>
        )}
        <Stat label="tokens">
          <span className="tabular">
            in {formatTokens(tokens.input)} · out {formatTokens(tokens.output)}
          </span>
          <Badge
            tone={tokens.reported ? "emerald" : "gray"}
            size="xs"
            mono
            title={tokens.reported ? "Usage reported by Ollama" : "No usage reported (fallback mode or usage unavailable)"}
          >
            {tokens.reported ? "reported" : "not reported"}
          </Badge>
        </Stat>
        <Stat label="prompt">
          <span className="tabular">{formatNumber(promptChars)} chars</span>
        </Stat>
        <Stat label="mode">
          <Badge tone={modeTone(mode)} mono size="xs">
            {mode}
          </Badge>
          <span className="truncate text-fg-muted" title={models.join(", ")}>
            {models.length === 0 ? "—" : models.join(", ")}
          </span>
        </Stat>
        <Stat label="trace">
          {effectiveTraceId ? (
            <>
              <span className="tabular text-cyan-300" title={effectiveTraceId}>
                {effectiveTraceId.slice(0, 8)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-2xs"
                icon={copyState === "copied" ? <Check size={11} aria-hidden className="text-emerald-300" /> : <Copy size={11} aria-hidden />}
                onClick={() => void copyTrace()}
                aria-label="Copy trace id"
                title={effectiveTraceId}
              >
                {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
              </Button>
              <span role="status" aria-live="polite" className="sr-only">
                {copyState === "copied" ? "Trace id copied" : copyState === "failed" ? "Copy failed" : ""}
              </span>
              {sentryHrefSafe ? (
                <a
                  href={sentryHrefSafe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                  Open in Sentry <ExternalLink size={11} aria-hidden />
                </a>
              ) : health?.sentryEnabled ? (
                <span className="text-fg-dim">set SENTRY_TRACE_URL_TEMPLATE to deep-link</span>
              ) : null}
            </>
          ) : (
            <>
              <span>—</span>
              <span className="text-fg-dim">no trace id (Sentry DSN not set during this run)</span>
            </>
          )}
        </Stat>
      </dl>

      {/* Waterfall */}
      <div role="list" aria-label="Agent waterfall" className="mt-1 divide-y divide-edge-faint">
        <div className="grid grid-cols-1 gap-x-3 pb-1 pt-2 md:grid-cols-[180px_minmax(0,1fr)_150px]" aria-hidden>
          <div className="hidden font-mono text-2xs uppercase tracking-wider text-fg-dim md:block">agent</div>
          <div className="tabular relative h-4 font-mono text-2xs text-fg-dim">
            {TICKS.map((p) => (
              <span
                key={p}
                className={clsx("absolute top-0 whitespace-nowrap", p === 0 ? "left-0" : p === 1 ? "right-0" : "-translate-x-1/2")}
                style={p > 0 && p < 1 ? { left: `${p * 100}%` } : undefined}
              >
                {timeline.t0 == null ? "—" : formatDuration(timeline.span * p)}
              </span>
            ))}
          </div>
          <div className="hidden font-mono text-2xs uppercase tracking-wider text-fg-dim md:block md:text-right">time · tokens · prompt</div>
        </div>
        {steps.map((s, i) => (
          <StepRow key={s.step} step={s} timing={timeline.rows[i]!} expanded={expanded.has(s.step)} onToggle={() => toggle(s.step)} />
        ))}
      </div>

      {/* Notes */}
      <div className="mt-2 space-y-1 font-mono text-2xs text-fg-dim">
        {timeline.tinyFallback && (
          <p className="flex items-start gap-1.5 text-amber-300/90">
            <Info size={12} aria-hidden className="mt-px shrink-0" />
            <span>Deterministic fallback: steps completed in under 10 ms; bars are drawn at minimum width.</span>
          </p>
        )}
        {timeline.incomplete && (
          <p className="flex items-start gap-1.5 text-amber-300/90">
            <Info size={12} aria-hidden className="mt-px shrink-0" />
            <span>Timing incomplete: a finished step has no endedAt/durationMs, so its bar is omitted rather than estimated.</span>
          </p>
        )}
        <p>
          One shared axis from the first step start to the {timeline.anyRunning ? "current moment" : "last step end"}. Timestamps are recorded
          in-process by the API; token counts are the usage the API recorded (Ollama's report when available; nothing is estimated here).
        </p>
      </div>
    </div>
  );
}
