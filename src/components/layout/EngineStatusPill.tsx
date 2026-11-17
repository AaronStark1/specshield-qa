import { clsx } from "clsx";
import { useEngineStatus, type EngineTone } from "../../hooks/useEngineStatus.ts";

const DOT: Record<EngineTone, string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-red-400",
  gray: "text-gray-400",
};

/**
 * The engine beacon: a dark-glass pill naming which engine is answering, with a live dot that is
 * green for the local Gemma model, amber for the built-in deterministic engine and red when the
 * API is down. Both engines run on this machine, hence "Offline".
 */
export function EngineStatusPill({ className }: { className?: string }) {
  const status = useEngineStatus();
  const local = status.tone === "emerald" || status.tone === "amber";
  return (
    <span role="status" title={status.detail} className={clsx("cyber-beacon", className)}>
      <span aria-hidden className={clsx("cyber-beacon-dot", DOT[status.tone], status.pulse && "is-live")} />
      <span className="truncate lg:hidden">{status.short}</span>
      <span className="hidden truncate lg:inline">
        {status.label}
        {local && " · Offline"}
      </span>
    </span>
  );
}
