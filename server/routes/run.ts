import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID, createHash } from "node:crypto";
import { env } from "../env.js";
import { resolveMode } from "../services/ollama.js";
import { events } from "../services/events.js";
import { TelemetryCollector, withPipelineSpan } from "../services/telemetry.js";
import { JsonStore } from "../services/store.js";
import { specShieldWorkflow } from "../mastra/workflows/specShieldWorkflow.js";
import { computeRoi, defaultAssumptions } from "@shared/roi.js";
import type { AgentMode, PipelineEvent, RoiAssumptions, RunRecord, TelemetryStep } from "@shared/types.js";

export const runRoute = new Hono();

function shortHash(spec: string): string {
  return createHash("sha256").update(spec.trim()).digest("hex").slice(0, 12);
}

function deriveTitle(spec: string, given?: string): string {
  if (given?.trim()) return given.trim().slice(0, 120);
  const m = spec.match(/^#\s+(.+)$/m);
  if (m?.[1]) return m[1].trim().slice(0, 120);
  return "Untitled Run";
}

runRoute.post("/", async (c) => {
  let body: { spec?: unknown; title?: unknown; assumptions?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const spec = typeof body.spec === "string" ? body.spec : "";
  if (spec.length < 80) {
    return c.json({ error: "spec must be at least 80 characters" }, 400);
  }
  const title = deriveTitle(spec, typeof body.title === "string" ? body.title : undefined);
  const partial = (body.assumptions ?? {}) as Partial<RoiAssumptions>;
  const defaults = defaultAssumptions(process.env as Record<string, string>);
  const assumptions: RoiAssumptions = {
    hourlyRateUsd: Number(partial.hourlyRateUsd ?? defaults.hourlyRateUsd),
    manualMinutesPerTestCase: Number(partial.manualMinutesPerTestCase ?? defaults.manualMinutesPerTestCase),
    cloudInputUsdPerMTok: Number(partial.cloudInputUsdPerMTok ?? defaults.cloudInputUsdPerMTok),
    cloudOutputUsdPerMTok: Number(partial.cloudOutputUsdPerMTok ?? defaults.cloudOutputUsdPerMTok),
  };

  const runId = randomUUID();
  const specChars = spec.length;
  const mode: AgentMode = await resolveMode();
  const model = env.GEMMA_MODEL;
  const now = Date.now();
  const initialSteps: TelemetryStep[] = [
    { step: "requirementParser", agentName: "Requirement Parser", status: "pending", mode, startedAt: now, model, promptChars: 0, inputTokens: 0, outputTokens: 0 },
    { step: "qaMatrixArchitect", agentName: "QA Matrix Architect", status: "pending", mode, startedAt: now, model, promptChars: 0, inputTokens: 0, outputTokens: 0 },
    { step: "playwrightCodegen", agentName: "Playwright Codegen", status: "pending", mode, startedAt: now, model, promptChars: 0, inputTokens: 0, outputTokens: 0 },
  ];
  TelemetryCollector.init(runId, initialSteps);

  return streamSSE(c, async (stream) => {
    const forward = (ev: PipelineEvent) => {
      void stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
    };
    const unsub = events.subscribe(runId, forward);
    const ping = setInterval(() => {
      void stream.writeSSE({ event: "ping", data: ": ping" }).catch(() => undefined);
    }, 10000);
    // Keep the writer happy on some proxies
    try {
      const startEv: PipelineEvent = { type: "pipeline:start", runId, mode, model };
      events.emit(runId, startEv);

      const output = await withPipelineSpan(runId, specChars, mode, async () => {
        const run = await specShieldWorkflow.createRun();
        const result = await run.start({ inputData: { runId, spec, title, mode } });
        if (result.status !== "success") {
          const err = result.status === "failed" ? (result as { error: Error }).error : new Error(`workflow ${result.status}`);
          throw err;
        }
        return (result as { result: { requirements: RunRecord["requirements"]; testCases: RunRecord["testCases"]; playwright: RunRecord["playwright"] } }).result;
      });

      const telemetry = TelemetryCollector.get(runId).map((s) => ({ ...s }));
      const modes = new Set(telemetry.map((t) => t.mode));
      const finalMode = (modes.size === 1 ? [...modes][0] : "mixed") as RunRecord["mode"];
      const roi = computeRoi(
        output.testCases.length,
        output.playwright.pageObjects.length,
        telemetry,
        assumptions,
        { promptChars: specChars + telemetry.reduce((s, t) => s + (t.promptChars ?? 0), 0), outputChars: output.playwright.combinedCode.length + output.playwright.specCode.length }
      );
      const record: RunRecord = {
        id: runId,
        createdAt: new Date().toISOString(),
        title,
        specHash: shortHash(spec),
        specChars,
        spec,
        mode: finalMode,
        model,
        requirements: output.requirements,
        testCases: output.testCases,
        playwright: output.playwright,
        telemetry,
        roi,
        sentryTraceId: telemetry[0]?.sentryTraceId,
      };
      await JsonStore.save(record);
      events.emit(runId, { type: "pipeline:end", runId, record });
      // give the SSE writer a beat to flush
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      const msg = (err as Error).message ?? "pipeline failed";
      events.emit(runId, { type: "error", runId, message: msg });
      await new Promise((r) => setTimeout(r, 150));
    } finally {
      clearInterval(ping);
      unsub();
      events.clear(runId);
    }
  });
});
