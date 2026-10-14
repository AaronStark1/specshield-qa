import { serve } from "@hono/node-server";
import { app } from "../server/app.js";
import { SAMPLE_SPEC, SAMPLE_SPEC_TITLE } from "../shared/sampleSpec.js";

process.env.FORCE_FALLBACK = "true";

async function main(): Promise<void> {
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => {
    (server as unknown as { on?: (ev: string, fn: () => void) => void }).on?.("listening", () => resolve());
    setTimeout(() => resolve(), 800);
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? (addr as { port: number }).port : 0;
  if (!port) throw new Error("could not determine smoke port");
  const base = `http://localhost:${port}`;
  const res = await fetch(`${base}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ spec: SAMPLE_SPEC, title: SAMPLE_SPEC_TITLE }),
  });
  if (!res.ok || !res.body) throw new Error(`POST /api/run failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let endRecord: { testCases: { category: string }[]; playwright: { combinedCode: string } } | null = null;
  const deadline = Date.now() + 30000;
  const pump = async (): Promise<void> => {
    while (true) {
      if (Date.now() > deadline) throw new Error("smoke timeout waiting for pipeline:end");
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          try {
            const ev = JSON.parse(data) as { type: string; record?: { testCases: { category: string }[]; playwright: { combinedCode: string } } };
            if (ev.type === "pipeline:end" && ev.record) {
              endRecord = ev.record;
              return;
            }
          } catch {
            // ignore
          }
        }
      }
    }
  };
  await pump();
  server.close();
  if (!endRecord) {
    console.error("SMOKE FAIL: no pipeline:end");
    process.exit(1);
  }
  const rec = endRecord as { testCases: { category: string }[]; playwright: { combinedCode: string } };
  const cats = new Set(rec.testCases.map((t) => t.category));
  const okCount = rec.testCases.length >= 18;
  const okCats = ["Functional", "Boundary", "Negative", "Security"].every((c) => cats.has(c));
  const okCode = rec.playwright.combinedCode.includes("@playwright/test");
  console.log(`SMOKE: ${rec.testCases.length} cases [${[...cats].join(",")}] playwright=${okCode ? "ok" : "missing"}`);
  if (!okCount || !okCats || !okCode) {
    console.error(`SMOKE FAIL: count>=18:${okCount} cats:${okCats} code:${okCode}`);
    process.exit(1);
  }
  console.log("SMOKE PASS");
}

main().catch((e) => {
  console.error("SMOKE FAIL:", (e as Error).message);
  process.exit(1);
});
