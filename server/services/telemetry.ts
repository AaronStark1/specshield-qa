import * as Sentry from "@sentry/node";
import type { StepId, TelemetryStep } from "@shared/types.js";

const store = new Map<string, TelemetryStep[]>();

export const TelemetryCollector = {
  init(runId: string, steps: TelemetryStep[]): void {
    store.set(runId, steps);
  },
  get(runId: string): TelemetryStep[] {
    return store.get(runId) ?? [];
  },
  update(runId: string, stepId: StepId, patch: Partial<TelemetryStep>): TelemetryStep | undefined {
    const steps = store.get(runId);
    if (!steps) return undefined;
    const s = steps.find((x) => x.step === stepId);
    if (!s) return undefined;
    Object.assign(s, patch);
    return s;
  },
  clear(runId: string): void {
    store.delete(runId);
  },
};

export function currentTraceIds(): { traceId?: string; spanId?: string } {
  try {
    const span = Sentry.getActiveSpan?.() as unknown as
      | { spanContext?: () => { traceId: string; spanId: string } }
      | undefined;
    const ctx = span?.spanContext?.();
    if (ctx) return { traceId: ctx.traceId, spanId: ctx.spanId };
  } catch {
    // no-op without Sentry
  }
  return {};
}

function isSentryOn(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

type AttrBag = Record<string, unknown>;

function setAttrs(span: unknown, attrs: AttrBag): void {
  try {
    const s = span as { setAttribute?: (k: string, v: unknown) => void; setAttributes?: (a: AttrBag) => void };
    if (typeof s?.setAttributes === "function") {
      s.setAttributes(attrs);
      return;
    }
    if (typeof s?.setAttribute === "function") {
      for (const [k, v] of Object.entries(attrs)) {
        if (v !== undefined) s.setAttribute(k, v as string | number | boolean);
      }
    }
  } catch {
    // ignore
  }
}

export async function withPipelineSpan<T>(
  runId: string,
  specChars: number,
  mode: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!isSentryOn()) return fn();
  try {
    return await Sentry.startSpan(
      {
        op: "ai.pipeline",
        name: "specShieldWorkflow",
        attributes: {
          "specshield.run_id": runId,
          "specshield.spec_chars": specChars,
          "specshield.mode": mode,
        },
      },
      async () => fn()
    );
  } catch {
    return fn();
  }
}

export async function withAgentSpan<T>(
  runId: string,
  step: StepId,
  agentName: string,
  model: string,
  fn: (api: {
    setUsage: (inputTokens: number, outputTokens: number) => void;
    setStatus: (status: "success" | "fallback" | "error") => void;
    setAttribute: (name: string, value: unknown) => void;
  }) => Promise<T>
): Promise<T> {
  if (!isSentryOn()) {
    return fn({ setUsage: () => undefined, setStatus: () => undefined, setAttribute: () => undefined });
  }
  try {
    return await Sentry.startSpan(
      {
        op: "gen_ai.invoke_agent",
        name: `invoke_agent ${agentName}`,
        attributes: {
          "gen_ai.operation.name": "invoke_agent",
          "gen_ai.agent.name": agentName,
          "gen_ai.request.model": model,
          "specshield.step": step,
          "specshield.run_id": runId,
        },
      },
      async (span) => {
        const api = {
          setUsage: (inputTokens: number, outputTokens: number) => {
            setAttrs(span, {
              "gen_ai.usage.input_tokens": inputTokens,
              "gen_ai.usage.output_tokens": outputTokens,
              "gen_ai.usage.total_tokens": inputTokens + outputTokens,
            });
          },
          setStatus: (status: "success" | "fallback" | "error") => {
            setAttrs(span, { "specshield.step_status": status });
          },
          setAttribute: (name: string, value: unknown) => {
            setAttrs(span, { [name]: value });
          },
        };
        try {
          const out = await fn(api);
          return out;
        } catch (err) {
          try {
            Sentry.captureException(err, { tags: { step } });
          } catch {
            // ignore
          }
          throw err;
        }
      }
    );
  } catch {
    return fn({ setUsage: () => undefined, setStatus: () => undefined, setAttribute: () => undefined });
  }
}

export interface ChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  responseModel?: string;
}

export async function withChatSpan(
  model: string,
  promptMessages: unknown,
  promptChars: number,
  fn: () => Promise<{ text: string; inputTokens: number; outputTokens: number; responseModel?: string }>
): Promise<ChatResult> {
  const runChat = async (): Promise<ChatResult> => {
    const r = await fn();
    return { text: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, responseModel: r.responseModel };
  };
  if (!isSentryOn()) return runChat();
  try {
    const temperature = Number(process.env.GEMMA_TEMPERATURE ?? "0.2");
    const maxTokens = Number(process.env.GEMMA_MAX_TOKENS ?? "4096");
    return await Sentry.startSpan(
      {
        op: "gen_ai.chat",
        name: `chat ${model}`,
        attributes: {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "ollama",
          "gen_ai.request.model": model,
          "gen_ai.request.temperature": temperature,
          "gen_ai.request.max_tokens": maxTokens,
          "gen_ai.input.messages": JSON.stringify(promptMessages).slice(0, 8000),
          "specshield.prompt_chars": promptChars,
        },
      },
      async (span) => {
        const r = await runChat();
        setAttrs(span, {
          "gen_ai.response.model": r.responseModel ?? model,
          "gen_ai.output.messages": JSON.stringify([{ role: "assistant", content: r.text.slice(0, 8000) }]),
          "gen_ai.usage.input_tokens": r.inputTokens,
          "gen_ai.usage.output_tokens": r.outputTokens,
          "gen_ai.usage.total_tokens": r.inputTokens + r.outputTokens,
        });
        return r;
      }
    );
  } catch {
    return runChat();
  }
}
