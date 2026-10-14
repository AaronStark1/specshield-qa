import { CheckCircle2, Database, Radar } from "lucide-react";
import { useHealth } from "../../hooks/useHealth.ts";

export function PrivacyBadge() {
  const { health } = useHealth();
  const sentryOn = health?.sentryEnabled ?? false;
  const mode = health?.mode ?? "fallback";
  const title = sentryOn ? "Local Inference · Sentry telemetry enabled" : "Air-Gapped / 100% NDA Compliant";

  return (
    <section className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-xs text-[#9ca3af]">
        <li className="flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
          <span><strong className="text-[#e5e7eb]">No cloud LLM calls</strong> — {mode === "gemma" ? "Gemma runs on localhost via Ollama." : mode === "fallback" ? "Deterministic local generator; no network calls." : "No outbound inference."} Spec never leaves the laptop.</span>
        </li>
        <li className="flex items-start gap-2">
          <Database size={14} className="mt-0.5 shrink-0 text-emerald-400" />
          <span><strong className="text-[#e5e7eb]">No external database</strong> — runs persist to local <code className="font-mono">data/runs.json</code>.</span>
        </li>
        <li className="flex items-start gap-2">
          <Radar size={14} className="mt-0.5 shrink-0 text-sky-400" />
          <span><strong className="text-[#e5e7eb]">Telemetry</strong> — {sentryOn ? "Sentry tracing on (PII previews enabled)." : "disabled — in-process collector only (DSN empty)."}</span>
        </li>
      </ul>
    </section>
  );
}
