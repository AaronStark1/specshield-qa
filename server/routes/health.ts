import { Hono } from "hono";
import { env } from "../env.js";
import { detectOllama, getLoadedModelContextLength, resolveMode } from "../services/ollama.js";
import type { HealthResponse } from "@shared/types.js";

export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  const [d, contextLength] = await Promise.all([detectOllama(), getLoadedModelContextLength()]);
  const forcedFallback = process.env.FORCE_FALLBACK === "true" || env.FORCE_FALLBACK;
  const mode = forcedFallback ? "fallback" : ((await resolveMode()) as HealthResponse["mode"]);
  const body: HealthResponse = {
    ok: true,
    ollamaReachable: d.reachable,
    modelAvailable: d.modelAvailable,
    model: env.GEMMA_MODEL,
    baseUrl: env.OLLAMA_BASE_URL,
    mode,
    forcedFallback,
    sentryEnabled: Boolean(process.env.SENTRY_DSN?.trim()),
    availableModels: d.models,
    contextLength,
  };
  return c.json(body);
});
