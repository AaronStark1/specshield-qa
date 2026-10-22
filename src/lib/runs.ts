import type { Priority, RunRecord, TelemetryStep, TestCase, TestCategory } from "@shared/types.js";

export type RunOutcome = "success" | "fallback" | "mixed" | "error" | "running" | "pending";

/** Sum of per-step durations; null when no step has finished. */
export function totalDurationMs(steps: TelemetryStep[]): number | null {
  const done = steps.filter((s) => typeof s.durationMs === "number");
  if (done.length === 0) return null;
  return done.reduce((acc, s) => acc + (s.durationMs ?? 0), 0);
}

/** Wall-clock span from the first start to the last end; null while any step is unfinished. */
export function wallClockMs(steps: TelemetryStep[]): number | null {
  if (steps.length === 0 || steps.some((s) => s.endedAt == null)) return null;
  const start = Math.min(...steps.map((s) => s.startedAt));
  const end = Math.max(...steps.map((s) => s.endedAt ?? 0));
  return end >= start ? end - start : null;
}

export function runOutcome(steps: TelemetryStep[]): RunOutcome {
  if (steps.length === 0) return "pending";
  if (steps.some((s) => s.status === "error")) return "error";
  if (steps.some((s) => s.status === "running")) return "running";
  if (steps.every((s) => s.status === "pending")) return "pending";
  if (steps.every((s) => s.status === "success")) return "success";
  if (steps.every((s) => s.status === "fallback")) return "fallback";
  return "mixed";
}

/** Token totals; `reported` is false when every step carries 0/0 (fallback mode or usage unavailable). */
export function tokenTotals(steps: TelemetryStep[]): { input: number; output: number; reported: boolean } {
  const input = steps.reduce((s, t) => s + (t.inputTokens ?? 0), 0);
  const output = steps.reduce((s, t) => s + (t.outputTokens ?? 0), 0);
  return { input, output, reported: input > 0 || output > 0 };
}

export function runDurationMs(run: Pick<RunRecord, "telemetry">): number | null {
  return totalDurationMs(run.telemetry ?? []);
}

export const CATEGORIES: TestCategory[] = ["Functional", "Boundary", "Negative", "Security"];
export const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

export function categoryCounts(cases: TestCase[]): Record<TestCategory, number> {
  const m: Record<TestCategory, number> = { Functional: 0, Boundary: 0, Negative: 0, Security: 0 };
  for (const c of cases) if (c.category in m) m[c.category] += 1;
  return m;
}

export function priorityCounts(cases: TestCase[]): Record<Priority, number> {
  const m: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const c of cases) if (c.priority in m) m[c.priority] += 1;
  return m;
}

/** Tone mapping shared by every badge that shows a category. */
export function categoryTone(cat: TestCategory): "emerald" | "amber" | "violet" | "cyan" {
  return cat === "Functional" ? "emerald" : cat === "Boundary" ? "amber" : cat === "Negative" ? "violet" : "cyan";
}

export function priorityTone(p: Priority): "red" | "amber" | "sky" | "gray" {
  return p === "P0" ? "red" : p === "P1" ? "amber" : p === "P2" ? "sky" : "gray";
}

export function modeTone(mode: string): "emerald" | "amber" | "violet" | "cyan" | "gray" {
  return mode === "gemma" ? "emerald" : mode === "fallback" ? "amber" : mode === "mixed" ? "violet" : "gray";
}

/** Badge tone for a run outcome (history list, diff header, telemetry summary). */
export function outcomeTone(o: RunOutcome): "emerald" | "amber" | "violet" | "red" | "gray" {
  switch (o) {
    case "success":
      return "emerald";
    case "fallback":
      return "amber";
    case "mixed":
    case "running":
      return "violet";
    case "error":
      return "red";
    default:
      return "gray";
  }
}
