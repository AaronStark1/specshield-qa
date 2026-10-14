import { serve } from "@hono/node-server";
import { app } from "../server/app.js";
import { SAMPLE_SPEC, SAMPLE_SPEC_TITLE } from "../shared/sampleSpec.js";
import type { PipelineEvent, RunRecord } from "../shared/types.js";

/**
 * Manual SSE probe: starts the app on a random port, POSTs SAMPLE_SPEC to
 * /api/run and prints live progress, each step's telemetry, and final timing table.
 * Usage: npx tsx scripts/sample-run.ts
 */
async function main(): Promise<void> {
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => setTimeout(resolve, 700));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? (addr as { port: number }).port : 8787;
  const base = `http://localhost:${port}`;
  console.log(`[sample-run] POST ${base}/api/run with "${SAMPLE_SPEC_TITLE}"`);
  const res = await fetch(`${base}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ spec: SAMPLE_SPEC, title: SAMPLE_SPEC_TITLE }),
  });
  if (!res.ok || !res.body) throw new Error(`POST failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const lines = chunk.split("\n");
      let evType = "?";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) evType = line.slice(6).trim();
        if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      void evType;
      if (!data) continue;
      try {
        const ev = JSON.parse(data) as PipelineEvent;
        if (ev.type === "pipeline:start") {
          console.log(`[sample-run] pipeline:start — mode: ${ev.mode}, model: ${ev.model}`);
        } else if (ev.type === "step:start") {
          console.log(`[sample-run] step:start — ${ev.step.agentName} (${ev.step.step})`);
        } else if (ev.type === "step:progress") {
          console.log(`  └─ [progress] ${ev.step}: ≈ ${ev.outputTokens} tokens · ${ev.tokensPerSecond} tok/s`);
        } else if (ev.type === "step:end") {
          const s = ev.step;
          const dur = s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : "—";
          console.log(`[sample-run] step:end — ${s.agentName}: status=${s.status}, mode=${s.mode}, duration=${dur}, in=${s.inputTokens}, out=${s.outputTokens}${s.error ? `, error=${s.error}` : ""}`);
        } else if (ev.type === "pipeline:end") {
          const rec: RunRecord = ev.record;
          console.log("\n======================== LIVE RUN SUMMARY ========================");
          console.log(`Run ID:      ${rec.id}`);
          console.log(`Run Title:   ${rec.title}`);
          console.log(`Overall Mode: ${rec.mode} (model: ${rec.model})`);
          console.log("------------------------------------------------------------------");
          console.log(
            "Step".padEnd(25) +
            "Mode".padEnd(10) +
            "Status".padEnd(10) +
            "Duration".padEnd(12) +
            "In Tokens".padEnd(12) +
            "Out Tokens".padEnd(12) +
            "Details"
          );
          console.log("------------------------------------------------------------------");
          let totalDuration = 0;
          let totalIn = 0;
          let totalOut = 0;
          for (const s of rec.telemetry) {
            const dur = s.durationMs ?? 0;
            totalDuration += dur;
            totalIn += s.inputTokens;
            totalOut += s.outputTokens;
            const durStr = `${(dur / 1000).toFixed(1)}s`;
            const details = s.error ? `Error: ${s.error}` : s.codegenStrategy ? `Strategy: ${s.codegenStrategy}` : "";
            console.log(
              s.agentName.padEnd(25) +
              s.mode.padEnd(10) +
              s.status.padEnd(10) +
              durStr.padEnd(12) +
              String(s.inputTokens).padEnd(12) +
              String(s.outputTokens).padEnd(12) +
              details
            );
          }
          console.log("------------------------------------------------------------------");
          console.log(
            "TOTAL".padEnd(45) +
            `${(totalDuration / 1000).toFixed(1)}s`.padEnd(12) +
            String(totalIn).padEnd(12) +
            String(totalOut).padEnd(12)
          );
          console.log("==================================================================\n");
          server.close();
          return;
        } else if (ev.type === "error") {
          console.error("pipeline error", data.slice(0, 500));
          server.close();
          process.exit(1);
        }
      } catch {
        console.log(`raw chunk: ${chunk.slice(0, 120)}`);
      }
    }
  }
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
