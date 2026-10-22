import { Hono } from "hono";
import * as Sentry from "@sentry/node";
import { env } from "../env.js";
import { detectOllama, getLoadedModelContextLength, resolveMode } from "../services/ollama.js";
import type { HealthResponse } from "@shared/types.js";

export const healthRoute = new Hono();

function sentryInitialized(dsnSet: boolean): boolean {
  if (!dsnSet) return false;
  try {
    return Sentry.isInitialized();
  } catch {
    return false;
  }
}

healthRoute.get("/", async (c) => {
  const [d, contextLength] = await Promise.all([detectOllama(), getLoadedModelContextLength()]);
  const forcedFallback = process.env.FORCE_FALLBACK === "true" || env.FORCE_FALLBACK;
  const mode = forcedFallback ? "fallback" : ((await resolveMode()) as HealthResponse["mode"]);
  const dsnSet = Boolean(process.env.SENTRY_DSN?.trim());
  const template = env.SENTRY_TRACE_URL_TEMPLATE;
  const body: HealthResponse = {
    ok: true,
    ollamaReachable: d.reachable,
    modelAvailable: d.modelAvailable,
    model: env.GEMMA_MODEL,
    baseUrl: env.OLLAMA_BASE_URL,
    mode,
    forcedFallback,
    sentryEnabled: dsnSet,
    sentryInitialized: sentryInitialized(dsnSet),
    sentryTraceUrlTemplate: template.includes("{traceId}") ? template : null,
    availableModels: d.models,
    contextLength,
  };
  return c.json(body);
});
