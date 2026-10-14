import { serve } from "@hono/node-server";
import { app } from "../server/app.js";
import { SAMPLE_SPEC, SAMPLE_SPEC_TITLE } from "../shared/sampleSpec.js";

/**
 * Manual SSE probe: starts the app on a random port, POSTs SAMPLE_SPEC to
 * /api/run and prints each SSE event type as it arrives.
 * Usage: npx tsx scripts/sample-run.ts
 */
async function main(): Promise<void> {
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => setTimeout(resolve, 700));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? (addr as { port: number }).port : 8787;
  const base = `http://localhost:${port}`;
  console.log(`[sample-run] POST ${base}/api/run`);
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
      if (!data) continue;
      try {
        const ev = JSON.parse(data) as { type?: string };
        console.log(`event: ${ev.type ?? evType}`);
        if (ev.type === "pipeline:end") {
          console.log("pipeline:end received — check data/runs.json");
          server.close();
          return;
        }
        if (ev.type === "error") {
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
