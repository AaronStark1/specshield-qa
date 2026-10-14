import type { PipelineEvent } from "@shared/types.js";

export async function runPipeline(
  spec: string,
  title: string,
  onEvent: (ev: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ spec, title }),
    signal,
  });
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Run failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const dispatch = (raw: string) => {
    // raw like "event: step:start\ndata: {...}" or "data: {...}"
    const lines = raw.split("\n");
    let eventName = "";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith(":")) continue; // comment/ping
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const data = dataLines.join("\n").trim();
    if (!data || data === ": ping") return;
    try {
      const ev = JSON.parse(data) as PipelineEvent;
      void eventName;
      onEvent(ev);
    } catch {
      // ignore partial
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (chunk.trim()) dispatch(chunk);
    }
  }
  if (buf.trim()) dispatch(buf);
}
