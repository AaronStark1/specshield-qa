import { useHealth } from "./useHealth.ts";

export type EngineTone = "emerald" | "amber" | "red" | "gray";

export interface EngineStatus {
  tone: EngineTone;
  label: string;
  /** One plain sentence explaining the state and, where useful, how to change it. */
  detail: string;
  pulse: boolean;
}

/** "gemma2:9b" → "Gemma 9B"; unknown shapes are returned unchanged. */
export function friendlyModelName(model: string): string {
  const match = model.match(/^([a-z]+)[\d.]*:(\d+(?:\.\d+)?[a-z])/i);
  if (!match?.[1] || !match[2]) return model;
  return `${match[1][0]!.toUpperCase()}${match[1].slice(1)} ${match[2].toUpperCase()}`;
}

/** One user-facing status for the generation engine, derived from the local API health probe. */
export function useEngineStatus(): EngineStatus {
  const { health, error } = useHealth();
  if (error) {
    return { tone: "red", label: "Studio API Offline", detail: "The local API is not answering. Start it with npm run dev.", pulse: false };
  }
  if (!health) {
    return { tone: "gray", label: "Checking Local Engine", detail: "Waiting for the local API to report its status.", pulse: true };
  }
  if (health.mode === "gemma") {
    return {
      tone: "emerald",
      label: `Local AI Ready (${friendlyModelName(health.model)})`,
      detail: "Specs are processed by the model running on this machine.",
      pulse: false,
    };
  }
  const reason = health.forcedFallback
    ? "The offline engine is switched on in this server's settings."
    : !health.ollamaReachable
      ? "Ollama is not running, so the built-in offline engine is used. Start Ollama to switch to local AI."
      : `${friendlyModelName(health.model)} is not installed in Ollama, so the built-in offline engine is used.`;
  return { tone: "amber", label: "Offline Deterministic Mode", detail: reason, pulse: false };
}
