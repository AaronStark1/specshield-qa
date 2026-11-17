import { clsx } from "clsx";
import { useEngineStatus, type EngineTone } from "../../hooks/useEngineStatus.ts";

const TONE: Record<EngineTone, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  gray: "border-white/10 bg-white/[0.04] text-fg-muted",
};

/**
 * The single engine indicator: "Local Offline Engine", followed by which engine is answering
 * (the local Gemma model or the built-in deterministic one). Turns red when the API is down.
 */
export function EngineStatusPill({ className }: { className?: string }) {
  const status = useEngineStatus();
  return (
    <span
      role="status"
      title={status.detail}
      className={clsx("inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", TONE[status.tone], className)}
    >
      <span aria-hidden className={clsx("status-dot", status.pulse && "animate-status-pulse")} />
      <span className="truncate">{status.label}</span>
      {status.engine && <span className="hidden truncate font-normal text-fg-muted sm:inline">· {status.engine}</span>}
    </span>
  );
}
