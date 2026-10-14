import { ShieldCheck } from "lucide-react";
import { useHealth } from "../../hooks/useHealth.ts";
import { Badge } from "../ui/Badge.tsx";

export function Header() {
  const { health } = useHealth();
  const isGemma = health?.mode === "gemma";
  const model = health?.model ?? "gemma2:9b";
  const sentryOn = health?.sentryEnabled ?? false;

  return (
    <header className="border-b border-[#1f2937] bg-[#0b0f17]/90">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <ShieldCheck size={18} />
          </span>
          <div>
            <div className="text-sm font-bold tracking-tight">◈ SpecShield QA</div>
            <div className="text-[11px] text-[#9ca3af]">Local spec-to-test studio</div>
          </div>
        </div>
        <div className="ml-2 hidden items-center gap-2 md:flex">
          <Badge tone="emerald">100% Local Gemma Inference | NDA Safe | $0.00 API Cost</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {health ? (
            isGemma ? (
              <Badge tone="emerald">● {model} · Local</Badge>
            ) : (
              <Badge tone="amber">▲ Deterministic Fallback · start Ollama for live inference</Badge>
            )
          ) : (
            <Badge tone="gray">… probing Ollama</Badge>
          )}
          <Badge tone={sentryOn ? "sky" : "gray"}>{sentryOn ? "Sentry Tracing on" : "Tracing off (DSN empty)"}</Badge>
        </div>
      </div>
      <div className="mx-auto max-w-[1500px] px-4 pb-2 md:hidden">
        <Badge tone="emerald">100% Local Gemma Inference | NDA Safe | $0.00 API Cost</Badge>
      </div>
    </header>
  );
}
