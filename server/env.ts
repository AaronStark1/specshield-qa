export interface AppEnv {
  OLLAMA_BASE_URL: string;
  GEMMA_MODEL: string;
  GEMMA_TEMPERATURE: number;
  GEMMA_MAX_TOKENS?: number;
  GEMMA_MAX_TOKENS_PARSER: number;
  GEMMA_MAX_TOKENS_MATRIX: number;
  GEMMA_MAX_TOKENS_CODEGEN: number;
  OLLAMA_TIMEOUT_MS: number;
  SENTRY_DSN: string;
  SENTRY_ENVIRONMENT: string;
  SENTRY_TRACES_SAMPLE_RATE: number;
  SENTRY_SEND_DEFAULT_PII: boolean;
  PORT: number;
  DATA_DIR: string;
  FORCE_FALLBACK: boolean;
  ROI_HOURLY_RATE_USD: number;
  ROI_MANUAL_MINUTES_PER_TEST_CASE: number;
  ROI_CLOUD_INPUT_USD_PER_MTOK: number;
  ROI_CLOUD_OUTPUT_USD_PER_MTOK: number;
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

const gemmaMaxOverride = process.env.GEMMA_MAX_TOKENS ? num(process.env.GEMMA_MAX_TOKENS, 4096) : undefined;

export const env: AppEnv = {
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434/v1",
  GEMMA_MODEL: process.env.GEMMA_MODEL?.trim() || "gemma2:9b",
  GEMMA_TEMPERATURE: num(process.env.GEMMA_TEMPERATURE, 0.2),
  GEMMA_MAX_TOKENS: gemmaMaxOverride,
  GEMMA_MAX_TOKENS_PARSER: gemmaMaxOverride ?? num(process.env.GEMMA_MAX_TOKENS_PARSER, 2048),
  GEMMA_MAX_TOKENS_MATRIX: gemmaMaxOverride ?? num(process.env.GEMMA_MAX_TOKENS_MATRIX, 3072),
  GEMMA_MAX_TOKENS_CODEGEN: gemmaMaxOverride ?? num(process.env.GEMMA_MAX_TOKENS_CODEGEN, 2560),
  OLLAMA_TIMEOUT_MS: num(process.env.OLLAMA_TIMEOUT_MS, 300000),
  SENTRY_DSN: process.env.SENTRY_DSN?.trim() ?? "",
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT?.trim() || "local",
  SENTRY_TRACES_SAMPLE_RATE: num(process.env.SENTRY_TRACES_SAMPLE_RATE, 1.0),
  SENTRY_SEND_DEFAULT_PII: process.env.SENTRY_SEND_DEFAULT_PII !== "false",
  PORT: num(process.env.PORT, 8787),
  DATA_DIR: process.env.DATA_DIR?.trim() || "./data",
  FORCE_FALLBACK: process.env.FORCE_FALLBACK === "true",
  ROI_HOURLY_RATE_USD: num(process.env.ROI_HOURLY_RATE_USD, 85),
  ROI_MANUAL_MINUTES_PER_TEST_CASE: num(process.env.ROI_MANUAL_MINUTES_PER_TEST_CASE, 12),
  ROI_CLOUD_INPUT_USD_PER_MTOK: num(process.env.ROI_CLOUD_INPUT_USD_PER_MTOK, 3),
  ROI_CLOUD_OUTPUT_USD_PER_MTOK: num(process.env.ROI_CLOUD_OUTPUT_USD_PER_MTOK, 15),
};
