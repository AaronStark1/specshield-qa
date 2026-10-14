import { Copy } from "lucide-react";
import type { TelemetryStep } from "@shared/types.js";
import { formatDuration, formatTokens } from "../../lib/format.ts";
import { Badge } from "../ui/Badge.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";

export function TelemetryDrawer({ steps, traceId }: { steps: TelemetryStep[]; traceId?: string }) {
  if (steps.length === 0) return <EmptyState title="No telemetry yet" hint="Run the pipeline — spans appear here even with Sentry DSN empty." />;
  const maxMs = Math.max(1, ...steps.map((s) => s.durationMs ?? 0));
  const totalIn = steps.reduce((s, t) => s + t.inputTokens, 0);
  const totalOut = steps.reduce((s, t) => s + t.outputTokens, 0);

  return (
    <div>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.step} className="rounded-xl border border-[#1f2937] bg-[#0b0f17] p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <strong>{s.agentName}</strong>
              <Badge tone={s.status === "success" ? "emerald" : s.status === "fallback" ? "amber" : "gray"}>{s.status}</Badge>
              <Badge tone={s.mode === "gemma" ? "violet" : "amber"}>{s.mode}</Badge>
              {s.codegenStrategy && <Badge tone="sky">strategy: {s.codegenStrategy}</Badge>}
              <span className="font-mono text-[#9ca3af]">{s.model || "—"}</span>
              <span className="ml-auto font-mono text-[#9ca3af]">{formatDuration(s.durationMs)} · in {formatTokens(s.inputTokens)} / out {formatTokens(s.outputTokens)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-black/40">
              <div className="h-full rounded bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${Math.max(4, ((s.durationMs ?? 0) / maxMs) * 100)}%` }} />
            </div>
            <div className="mt-1 font-mono text-[11px] text-[#6b7280]">prompt {s.promptChars} chars · trace {s.sentryTraceId?.slice(0, 8) ?? "—"} / span {s.sentrySpanId?.slice(0, 8) ?? "—"}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-[#1f2937] bg-[#111827] p-3 text-xs">
        <div className="flex flex-wrap gap-3 font-mono text-[#9ca3af]">
          <span>Total in/out: {formatTokens(totalIn)} / {formatTokens(totalOut)}</span>
          {traceId && (
            <span className="inline-flex items-center gap-1">
              trace {traceId}
              <button onClick={() => void navigator.clipboard.writeText(traceId)} title="Copy trace ID" className="text-sky-300 hover:text-white"><Copy size={12} /></button>
            </span>
          )}
        </div>
        <p className="mt-1 text-[#9ca3af]">Waterfall bars are scaled to the longest step. Open Sentry → Insights → AI → Agents to see this trace when tracing is on.</p>
      </div>
    </div>
  );
}
