import { env } from "../env.js";

let cache: { at: number; reachable: boolean; models: string[] } | null = null;

function baseWithoutV1(): string {
  return env.OLLAMA_BASE_URL.replace(/\/v1\/?$/, "");
}

export async function detectOllama(): Promise<{ reachable: boolean; models: string[]; modelAvailable: boolean }> {
  const now = Date.now();
  if (cache && now - cache.at < 30_000) {
    return {
      reachable: cache.reachable,
      models: cache.models,
      modelAvailable: modelMatches(cache.models, env.GEMMA_MODEL),
    };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(`${env.OLLAMA_BASE_URL}/models`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { data?: { id: string }[] };
      const models = (body.data ?? []).map((m) => m.id).filter(Boolean);
      cache = { at: now, reachable: true, models };
      return { reachable: true, models, modelAvailable: modelMatches(models, env.GEMMA_MODEL) };
    } finally {
      clearTimeout(t);
    }
  } catch {
    // Try native Ollama /api/tags as a secondary probe (helps when base URL shape differs)
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      try {
        const res = await fetch(`${baseWithoutV1()}/api/tags`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { models?: { name: string }[] };
        const models = (body.models ?? []).map((m) => m.name).filter(Boolean);
        cache = { at: now, reachable: true, models };
        return { reachable: true, models, modelAvailable: modelMatches(models, env.GEMMA_MODEL) };
      } finally {
        clearTimeout(t);
      }
    } catch {
      cache = { at: now, reachable: false, models: [] };
      return { reachable: false, models: [], modelAvailable: false };
    }
  }
}

export function modelMatches(models: string[], wanted: string): boolean {
  const w = wanted.trim().toLowerCase();
  const wBase = w.replace(/:latest$/, "");
  return models.some((m) => {
    const ml = m.toLowerCase();
    if (ml === w || ml === `${w}:latest`) return true;
    if (ml.replace(/:latest$/, "") === wBase && !ml.includes("q4_") && !ml.includes("q5_")) {
      // tolerate ":latest" suffix; do not match quant variants like "-instruct-q4_K_M"
      if (ml === wBase || ml === `${wBase}:latest`) return true;
    }
    return false;
  });
}

export async function resolveMode(): Promise<"gemma" | "fallback"> {
  if (env.FORCE_FALLBACK) return "fallback";
  // Also honour runtime env override (smoke sets FORCE_FALLBACK=true per-process)
  if (process.env.FORCE_FALLBACK === "true") return "fallback";
  const d = await detectOllama();
  return d.reachable && d.modelAvailable ? "gemma" : "fallback";
}

export function clearOllamaCache(): void {
  cache = null;
}

export async function getLoadedModelContextLength(): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(`${baseWithoutV1()}/api/ps`, { signal: ctrl.signal });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        models?: { name?: string; model?: string; context_length?: number }[];
      };
      if (!body.models || body.models.length === 0) return null;
      const wanted = env.GEMMA_MODEL.toLowerCase().trim();
      const match =
        body.models.find((m) => {
          const n = (m.name ?? m.model ?? "").toLowerCase().trim();
          return modelMatches([n], wanted);
        }) ?? body.models[0];
      return typeof match?.context_length === "number" ? match.context_length : null;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}
