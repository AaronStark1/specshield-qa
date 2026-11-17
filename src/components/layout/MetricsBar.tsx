import { clsx } from "clsx";
import { useCountUp } from "../../hooks/useCountUp.ts";
import { useHealth } from "../../hooks/useHealth.ts";
import { useOutboundAudit } from "../../hooks/useOutboundAudit.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { CONTAINER } from "../../lib/layout.ts";
import { formatDuration, formatUsdSmart } from "../../lib/format.ts";
import { modeLabel, tokenTotals, totalDurationMs, wallClockMs } from "../../lib/runs.ts";

/** Runs faster than this are reported as "< 120ms"; slower ones show their measured time. */
const LATENCY_BUDGET_MS = 120;
/** Where the cost counter starts before it settles on $0.00. */
const COST_COUNT_FROM = 9.99;

interface Metric {
  id: string;
  from?: number;
  to: number;
  format: (value: number) => string;
  label: string;
  note: string;
  warn?: boolean;
}

function MetricCard({ metric, replayKey, busy }: { metric: Metric; replayKey: string; busy: boolean }) {
  const value = useCountUp(metric.to, { from: metric.from, replayKey });
  return (
    <div className={clsx("studio-panel flex min-w-0 flex-col-reverse justify-end gap-2.5 px-5 py-4", metric.warn && "panel-warn")}>
      <dt className="min-w-0">
        <span className={clsx("block text-13 font-medium", metric.warn ? "text-amber-200" : "text-fg")}>{metric.label}</span>
        <span className={clsx("mt-0.5 block truncate font-mono text-2xs uppercase tracking-wider", metric.warn ? "text-amber-300/80" : "text-fg-dim")} title={metric.note}>
          {metric.note}
        </span>
      </dt>
      <dd className={clsx("metric-value whitespace-nowrap text-[clamp(26px,2.4vw,36px)] transition-opacity duration-300", busy && "opacity-40")}>{metric.format(value)}</dd>
    </div>
  );
}

/**
 * The four live matrix stats docked at the base of the studio, one glass box each. Before a run they show what the built-in
 * offline engine delivers for the bundled sample; once a run completes they count up to that run's
 * own figures: its measured time, this tab's outbound traffic, its cloud cost and its test count.
 */
export function MetricsBar() {
  const run = usePipelineStore((s) => s.currentRun);
  const running = usePipelineStore((s) => s.running);
  const { health } = useHealth();
  const audit = useOutboundAudit();

  const latencyMs = run ? (wallClockMs(run.telemetry) ?? totalDurationMs(run.telemetry)) : null;
  const withinBudget = latencyMs === null || latencyMs < LATENCY_BUDGET_MS;
  const latency: Metric = {
    id: "latency",
    to: withinBudget ? LATENCY_BUDGET_MS : latencyMs,
    format: withinBudget ? (v) => `< ${Math.round(v)}ms` : (v) => formatDuration(v),
    label: "Latency / Turnaround",
    note: !run ? "Offline engine baseline" : withinBudget ? `Measured ${formatDuration(latencyMs)} · ${modeLabel(run.mode)}` : `Measured · ${modeLabel(run.mode)}`,
  };

  const tracing = health?.sentryEnabled === true;
  const leaking = audit.externalRequests > 0;
  const offline: Metric = {
    id: "offline",
    to: 100,
    format: (v) => `${Math.round(v)}%`,
    label: tracing || leaking ? "Local Inference" : "Air-Gapped",
    note: leaking
      ? `${audit.externalRequests} external request${audit.externalRequests === 1 ? "" : "s"} from this tab`
      : tracing
        ? "Tracing on · diagnostics leave this machine"
        : "0 outbound requests from this tab",
    warn: tracing || leaking,
  };

  const tokens = run ? tokenTotals(run.telemetry) : null;
  const cost: Metric = {
    id: "cost",
    from: COST_COUNT_FROM,
    to: 0,
    format: (v) => `$${v.toFixed(2)}`,
    label: "Cloud Cost / Token Spend",
    note: run && tokens?.reported ? `vs ${formatUsdSmart(run.roi.cloudEquivalentCostUsd)} on a cloud API` : "No API key, no token bill",
  };

  const caseCount = run?.testCases.length ?? 0;
  const mapped = run?.playwright.coverage.length ?? 0;
  const pageObjects = run?.playwright.pageObjects.length ?? 0;
  const tests: Metric = {
    id: "tests",
    to: run ? caseCount : 30,
    format: (v) => (run ? String(Math.round(v)) : `${Math.round(v)}+`),
    label: "Playwright POM Tests",
    note: !run
      ? "Invoice Tracker sample"
      : mapped === caseCount
        ? `${pageObjects} page object${pageObjects === 1 ? "" : "s"}`
        : `${mapped} of ${caseCount} mapped to Playwright`,
  };

  const replayKey = run?.id ?? "baseline";
  return (
    <section aria-label="Run metrics" aria-busy={running || undefined} className={`${CONTAINER} relative z-[1] pb-4`}>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[latency, offline, cost, tests].map((metric) => (
          <MetricCard key={metric.id} metric={metric} replayKey={replayKey} busy={running} />
        ))}
      </dl>
    </section>
  );
}
