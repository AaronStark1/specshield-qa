import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Circle, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import type { TelemetryStep } from "@shared/types.js";
import { formatDuration, formatTokens } from "../../lib/format.ts";
import { Badge } from "../ui/Badge.tsx";

function useElapsed(running: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => setT(Date.now() - t0), 200);
    return () => clearInterval(id);
  }, [running]);
  return t;
}

export function AgentStepCard({ step }: { step: TelemetryStep }) {
  const running = step.status === "running";
  const elapsed = useElapsed(running);
  const tone = step.mode === "gemma" ? "violet" : "amber";

  return (
    <div className={clsx("relative rounded-xl border bg-[#111827] p-3", running ? "border-violet-500/50 pulse-ring" : "border-[#1f2937]")}>
      <div className="flex items-center gap-2">
        {step.status === "pending" && <Circle size={15} className="text-[#4b5563]" />}
        {running && <Loader2 size={15} className="animate-spin text-violet-300" />}
        {(step.status === "success" || step.status === "fallback") && <CheckCircle2 size={15} className={step.status === "success" ? "text-emerald-400" : "text-amber-300"} />}
        {step.status === "error" && <AlertTriangle size={15} className="text-red-400" />}
        <span className="text-[13px] font-semibold">{step.agentName}</span>
        {step.status !== "pending" && <span className="ml-auto"><Badge tone={tone}>{step.mode === "gemma" ? "Gemma" : "Fallback"}</Badge></span>}
      </div>
      <div className="mt-2 font-mono text-[11px] text-[#9ca3af]">
        {running ? (
          <div>
            <div>{(elapsed / 1000).toFixed(1)}s elapsed…</div>
            {step.progress && (
              <div className="text-[10px] text-violet-300">
                ≈ {step.progress.outputTokens} tokens · {step.progress.tokensPerSecond} tok/s
              </div>
            )}
          </div>
        ) : step.durationMs != null ? (
          <span>{formatDuration(step.durationMs)} · in {formatTokens(step.inputTokens)} · out {formatTokens(step.outputTokens)} tokens</span>
        ) : (
          <span>waiting…</span>
        )}
      </div>
      {step.error && <p className="mt-1 text-[11px] text-amber-300/90">fallback reason: {step.error.slice(0, 160)}</p>}
    </div>
  );
}

export function PipelineProgress({ steps }: { steps: TelemetryStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {steps.map((s) => (
        <AgentStepCard key={s.step} step={s} />
      ))}
    </div>
  );
}
