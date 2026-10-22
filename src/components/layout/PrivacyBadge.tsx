import type { ReactNode } from "react";
import { Cpu, Database, Radar, Server, ShieldCheck } from "lucide-react";
import { useHealth } from "../../hooks/useHealth.ts";
import { formatNumber, formatRelative } from "../../lib/format.ts";
import { Badge, type BadgeTone } from "../ui/Badge.tsx";
import { Panel } from "../ui/Panel.tsx";

type Verification = "verified" | "design" | "unverified";

interface Row {
  key: string;
  icon: ReactNode;
  label: string;
  status: { tone: BadgeTone; text: string; dot?: boolean | "pulse" };
  detail: ReactNode;
  verification: Verification;
}

const VERIFICATION_TAG: Record<Verification, { tone: BadgeTone; text: string; title: string }> = {
  verified: { tone: "emerald", text: "VERIFIED", title: "Observed live through /api/health" },
  design: { tone: "gray", text: "BY DESIGN", title: "How the code is written; not monitored at runtime" },
  unverified: { tone: "gray", text: "UNVERIFIED", title: "The API health probe is not reachable" },
};

/** "http://localhost:11434/v1" → "localhost:11434"; falls back to the raw string. */
function hostPort(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || baseUrl;
  } catch {
    return baseUrl;
  }
}

/** Privacy posture, split into what the health probe can observe and what is only true by construction. */
export function PrivacyBadge() {
  const { health, error, checkedAt } = useHealth();
  const offline = error !== null;
  const probed = health !== null && !offline;
  const checked = checkedAt !== null ? formatRelative(new Date(checkedAt).toISOString()) : null;

  const UNKNOWN: Row["status"] = { tone: "gray", text: "UNKNOWN" };

  const rows: Row[] = [];

  // 1. Inference endpoint
  if (probed) {
    const gemma = health.mode === "gemma";
    const reason = health.forcedFallback
      ? "fallback forced by configuration"
      : !health.ollamaReachable
        ? `Ollama unreachable at ${hostPort(health.baseUrl)}`
        : !health.modelAvailable
          ? `${health.model} not in Ollama's list`
          : "fallback selected by the API";
    rows.push({
      key: "endpoint",
      icon: <Cpu size={14} />,
      label: "Inference endpoint",
      status: gemma ? { tone: "emerald", text: "LOCAL", dot: true } : { tone: "amber", text: "NO MODEL CALL", dot: true },
      detail: gemma ? (
        <>
          Ollama at <code className="font-mono text-fg">{hostPort(health.baseUrl)}</code> · live local inference
        </>
      ) : (
        <>deterministic generator on the API · {reason}</>
      ),
      verification: "verified",
    });
  } else {
    rows.push({
      key: "endpoint",
      icon: <Cpu size={14} />,
      label: "Inference endpoint",
      status: UNKNOWN,
      detail: offline ? "API unreachable; the last health probe failed" : "waiting for the first health probe",
      verification: "unverified",
    });
  }

  // 2. Model
  if (probed) {
    const ctx = health.contextLength ? ` · ${formatNumber(health.contextLength)} ctx` : "";
    const others = health.availableModels.length;
    rows.push({
      key: "model",
      icon: <Server size={14} />,
      label: "Model",
      status: health.modelAvailable ? { tone: "emerald", text: "AVAILABLE" } : { tone: "amber", text: "NOT LISTED" },
      detail: (
        <>
          <code className="font-mono text-fg">{health.model || "—"}</code>
          {health.modelAvailable ? ` · listed by Ollama${ctx}` : ` · not in Ollama's model list${others > 0 ? ` (${others} available)` : ""}`}
          {health.forcedFallback ? " · not used while fallback is forced" : ""}
        </>
      ),
      verification: "verified",
    });
  } else {
    rows.push({
      key: "model",
      icon: <Server size={14} />,
      label: "Model",
      status: UNKNOWN,
      detail: offline ? "cannot read the model list while the API is offline" : "waiting for the first health probe",
      verification: "unverified",
    });
  }

  // 3. Run history (architecture; the browser cannot observe the file system)
  rows.push({
    key: "history",
    icon: <Database size={14} />,
    label: "Run history",
    status: { tone: "gray", text: "ON DISK" },
    detail: (
      <>
        <code className="font-mono text-fg">data/runs.json</code> on the API host; no external database
      </>
    ),
    verification: "design",
  });

  // 4. External integrations
  if (probed) {
    if (health.sentryEnabled) {
      const init = health.sentryInitialized === undefined ? "" : health.sentryInitialized ? " · SDK initialised" : " · SDK not initialised";
      rows.push({
        key: "integrations",
        icon: <Radar size={14} />,
        label: "External integrations",
        status: { tone: "cyan", text: "SENTRY", dot: true },
        detail: (
          <>
            <span className="text-amber-300">spans are sent to Sentry's cloud, plus prompt/response previews when PII is enabled (the default)</span>
            <span className="text-fg-dim"> · configured{init}; delivery not verified</span>
          </>
        ),
        verification: "verified",
      });
    } else {
      rows.push({
        key: "integrations",
        icon: <Radar size={14} />,
        label: "External integrations",
        status: { tone: "gray", text: "TRACING OFF" },
        detail: "no outbound telemetry configured (Sentry DSN empty)",
        verification: "verified",
      });
    }
  } else {
    rows.push({
      key: "integrations",
      icon: <Radar size={14} />,
      label: "External integrations",
      status: UNKNOWN,
      detail: offline ? "cannot read the telemetry configuration while the API is offline" : "waiting for the first health probe",
      verification: "unverified",
    });
  }

  const headerStatus = offline ? (
    <Badge tone="red" dot="pulse" mono title={error ?? "API unreachable"}>
      API OFFLINE
    </Badge>
  ) : probed ? (
    <span className="font-mono text-2xs text-fg-dim" title={checkedAt !== null ? new Date(checkedAt).toLocaleString() : undefined}>
      checked {checked ?? "—"}
    </span>
  ) : (
    <Badge tone="gray" dot="pulse" mono>
      PROBING
    </Badge>
  );

  return (
    <Panel title="Privacy shield" subtitle="verified vs by design" icon={<ShieldCheck size={14} />} actions={headerStatus}>
      <ul className="divide-y divide-edge">
        {rows.map((row) => {
          const tag = VERIFICATION_TAG[row.verification];
          return (
            <li key={row.key} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
              <span className="mt-0.5 shrink-0 text-fg-muted" aria-hidden>
                {row.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-13 font-medium text-fg">{row.label}</span>
                  <Badge tone={row.status.tone} mono size="xs" dot={row.status.dot}>
                    {row.status.text}
                  </Badge>
                  <Badge tone={tag.tone} mono size="xs" className="ml-auto" title={tag.title}>
                    {tag.text}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{row.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-edge pt-2.5 text-2xs leading-relaxed text-fg-dim">
        Verified = observed through the local API health probe{checked ? ` (checked ${checked})` : ""}. By design = how the code is
        written; not independently monitored. This UI does not inspect network traffic and makes no air-gap, antivirus or compliance
        guarantees.
      </p>
    </Panel>
  );
}
