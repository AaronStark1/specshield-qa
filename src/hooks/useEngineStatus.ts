import { useHealth } from "./useHealth.ts";

export type EngineTone = "emerald" | "amber" | "red" | "gray";

export interface EngineStatus {
  tone: EngineTone;
  /** Which engine is answering, e.g. "Local Gemma 9B" or "Deterministic Engine". */
  label: string;
  /** The same in one or two words, for narrow headers. */
  short: string;
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
    return { tone: "red", label: "Studio API Offline", short: "API Offline", detail: "The local API is not answering. Start it with npm run dev.", pulse: false };
  }
  if (!health) {
    return { tone: "gray", label: "Checking Engine", short: "Checking", detail: "Waiting for the local API to report its status.", pulse: true };
  }
  if (health.mode === "gemma") {
    const model = friendlyModelName(health.model);
    return { tone: "emerald", label: `Local ${model}`, short: model, detail: "Specs are processed by the model running on this machine.", pulse: true };
  }
  const reason = health.forcedFallback
    ? "The built-in deterministic engine is switched on in this server's settings."
    : !health.ollamaReachable
      ? "Ollama is not running, so the built-in deterministic engine is used. Start Ollama to switch to local AI."
      : `${friendlyModelName(health.model)} is not installed in Ollama, so the built-in deterministic engine is used.`;
  return { tone: "amber", label: "Deterministic Engine", short: "Deterministic", detail: reason, pulse: true };
}
