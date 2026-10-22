import type { ReactNode } from "react";
import { clsx } from "clsx";
import { ShieldCheck } from "lucide-react";
import type { HealthResponse } from "@shared/types.js";
import { useHealth } from "../../hooks/useHealth.ts";
import { getModifierLabel, useCommandShortcuts } from "../../hooks/useCommandShortcuts.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { formatRelative } from "../../lib/format.ts";
import { Badge, type BadgeTone } from "../ui/Badge.tsx";
import { Kbd } from "../ui/Kbd.tsx";
import { Tooltip } from "../ui/Tooltip.tsx";

interface ChipSpec {
  tone: BadgeTone;
  dot: boolean | "pulse";
  text: string;
  tip: ReactNode;
}

/** "localhost:11434" from "http://localhost:11434"; falls back to the raw value. */
function hostOf(baseUrl: string | undefined): string {
  if (!baseUrl) return "localhost:11434";
  try {
    return new URL(baseUrl).host || baseUrl;
  } catch {
    return baseUrl;
  }
}

function probedAgo(checkedAt: number | null): string {
  return checkedAt == null ? "never" : formatRelative(new Date(checkedAt).toISOString());
}

function TipLine({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return <p className={clsx("mt-1 first:mt-0", dim && "font-mono text-2xs uppercase tracking-wider text-fg-dim")}>{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-white/[0.06] px-1 py-px font-mono text-[10.5px] text-fg">{children}</code>;
}

function inferenceChip(health: HealthResponse | null, error: string | null, checkedAt: number | null): ChipSpec {
  if (error) {
    return {
      tone: "red",
      dot: true,
      text: "API OFFLINE",
      tip: (
        <>
          <TipLine>
            Cannot reach <Code>/api/health</Code> — {error}.
          </TipLine>
          <TipLine>
            Start the API with <Code>npm run dev</Code>.{health ? " Other chips show the last known state." : ""}
          </TipLine>
          <TipLine dim>last probe {probedAgo(checkedAt)}</TipLine>
        </>
      ),
    };
  }

  if (!health) {
    return {
      tone: "gray",
      dot: "pulse",
      text: "PROBING OLLAMA",
      tip: (
        <TipLine>
          Waiting for the first <Code>/api/health</Code> probe. The inference mode is unknown until the API answers.
        </TipLine>
      ),
    };
  }

  const host = hostOf(health.baseUrl);
  const model = health.model || "model";

  if (health.mode === "gemma") {
    return {
      tone: "emerald",
      dot: true,
      text: `${model.toUpperCase()} · LOCAL`,
      tip: (
        <>
          <TipLine>
            Live inference via Ollama at <Code>{host}</Code>. Prompts only go to that local endpoint.
          </TipLine>
          <TipLine>
            <Code>{model}</Code> is present in Ollama's model list.
          </TipLine>
          <TipLine dim>last checked {probedAgo(checkedAt)}</TipLine>
        </>
      ),
    };
  }

  const models = health.availableModels ?? [];
  const reason = health.forcedFallback ? (
    <>
      <Code>FORCE_FALLBACK=true</Code> is set on the API.
    </>
  ) : !health.ollamaReachable ? (
    <>
      Ollama is unreachable at <Code>{host}</Code>.
    </>
  ) : (
    <>
      <Code>{model}</Code> is not in Ollama's model list
      {models.length > 0 ? <> (available: {models.join(", ")})</> : null}.
    </>
  );
  const fix = health.forcedFallback ? (
    <>
      unset <Code>FORCE_FALLBACK</Code> and restart the API.
    </>
  ) : !health.ollamaReachable ? (
    <>
      start Ollama (<Code>ollama serve</Code>); the next probe picks it up.
    </>
  ) : (
    <>
      run <Code>ollama pull {model}</Code>.
    </>
  );

  return {
    tone: "amber",
    dot: true,
    text: "DETERMINISTIC FALLBACK",
    tip: (
      <>
        <TipLine>{reason}</TipLine>
        <TipLine>Generation uses the built-in rule-based generator — no model call is made.</TipLine>
        <TipLine>To enable Gemma: {fix}</TipLine>
        <TipLine dim>last checked {probedAgo(checkedAt)}</TipLine>
      </>
    ),
  };
}

function sentryChip(health: HealthResponse | null): ChipSpec {
  if (!health) {
    return {
      tone: "gray",
      dot: false,
      text: "TRACING —",
      tip: <TipLine>Tracing status is unknown until the API answers its first health probe.</TipLine>,
    };
  }
  if (!health.sentryEnabled) {
    return {
      tone: "gray",
      dot: false,
      text: "TRACING OFF",
      tip: (
        <TipLine>
          <Code>SENTRY_DSN</Code> is empty. Spans stay in-process; nothing is sent anywhere.
        </TipLine>
      ),
    };
  }
  if (health.sentryInitialized === true) {
    return {
      tone: "cyan",
      dot: true,
      text: "SENTRY · CONFIGURED",
      tip: (
        <>
          <TipLine>DSN set and the SDK initialised on the API. Delivery to Sentry is not verified from this UI.</TipLine>
          <TipLine>Sends spans and, with PII enabled, prompt/response previews to Sentry's cloud.</TipLine>
        </>
      ),
    };
  }
  if (health.sentryInitialized === false) {
    return {
      tone: "amber",
      dot: true,
      text: "SENTRY · UNAVAILABLE",
      tip: (
        <TipLine>
          <Code>SENTRY_DSN</Code> is set but the SDK did not initialise on the API. Check the API log; no spans are being delivered.
        </TipLine>
      ),
    };
  }
  return {
    tone: "sky",
    dot: true,
    text: "SENTRY · DSN SET",
    tip: (
      <>
        <TipLine>
          <Code>SENTRY_DSN</Code> is set. This API build does not report whether the SDK initialised, so delivery cannot be confirmed here.
        </TipLine>
        <TipLine>If it did, spans and (with PII enabled) prompt/response previews go to Sentry's cloud.</TipLine>
      </>
    ),
  };
}

function StatusChip({ chip, label, wide }: { chip: ChipSpec; label: string; wide?: boolean }) {
  return (
    <Tooltip content={chip.tip} align="end" wide={wide} className="max-w-full">
      <button
        type="button"
        aria-label={`${label}: ${chip.text}`}
        className="inline-flex max-w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <Badge tone={chip.tone} mono dot={chip.dot}>
          {chip.text}
        </Badge>
      </button>
    </Tooltip>
  );
}

export function Header() {
  useCommandShortcuts();
  const { health, error, checkedAt } = useHealth();
  const running = usePipelineStore((s) => s.running);
  const mod = getModifierLabel();

  const inference = inferenceChip(health, error, checkedAt);
  const sentry = sentryChip(health);
  const ctx = health?.contextLength ?? null;
  const lowCtx = ctx != null && ctx < 8192;

  return (
    <header className="glass sticky top-0 z-40 border-b border-edge">
      <div className="mx-auto flex min-h-[52px] w-full max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-1.5 xl:px-6">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <ShieldCheck size={16} strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5 tracking-tight text-fg">SpecShield QA</div>
            <div className="hidden font-mono text-2xs uppercase tracking-wider text-fg-dim sm:block">Local spec-to-test studio</div>
          </div>
        </div>

        {/* Status cluster — right-anchored so chips appearing on its left never shift the others */}
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {running && (
            <Badge tone="violet" mono dot="pulse" title="A pipeline run is in progress">
              RUNNING
            </Badge>
          )}
          <StatusChip chip={inference} label="Inference mode" wide />
          {lowCtx && (
            <StatusChip
              label="Context window"
              chip={{
                tone: "amber",
                dot: true,
                text: `CTX ${ctx}`,
                tip: (
                  <>
                    <TipLine>Ollama's context window is {ctx} tokens; long specs may be truncated.</TipLine>
                    <TipLine>
                      Restart Ollama with <Code>OLLAMA_CONTEXT_LENGTH=8192</Code>.
                    </TipLine>
                  </>
                ),
              }}
            />
          )}
          <StatusChip chip={sentry} label="Tracing" wide />

          <div className="ml-1 hidden items-center gap-2.5 border-l border-edge pl-3 md:flex">
            <span className="inline-flex items-center gap-1 font-mono text-2xs text-fg-dim">
              {mod === "⌘" ? (
                <Kbd size="xs">⌘↵</Kbd>
              ) : (
                <>
                  <Kbd size="xs">Ctrl</Kbd>
                  <Kbd size="xs">↵</Kbd>
                </>
              )}
              run
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-2xs text-fg-dim">
              <Kbd size="xs">Esc</Kbd>
              dismiss
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
