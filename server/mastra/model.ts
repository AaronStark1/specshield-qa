import { env } from "../env.js";

// Ollama OpenAI-compatible endpoint config for Mastra.
// Verified against installed @mastra/core 1.77 types:
// OpenAICompatibleConfig = { id: `${string}/${string}`; url?; apiKey? } | { providerId; modelId; url?; ... }
// "custom/<ollama model name>" routes through Mastra's OpenAI-compatible provider.
export const GEMMA_MODEL_NAME = env.GEMMA_MODEL;
export const OLLAMA_BASE_URL = env.OLLAMA_BASE_URL;

export const gemmaModel = {
  id: `custom/${GEMMA_MODEL_NAME}`,
  url: OLLAMA_BASE_URL,
  apiKey: "ollama",
} as const;

export function modelDisplayName(): string {
  return GEMMA_MODEL_NAME;
}

export function modelSettings(): { temperature: number; maxTokens: number } {
  return { temperature: env.GEMMA_TEMPERATURE, maxTokens: env.GEMMA_MAX_TOKENS };
}
