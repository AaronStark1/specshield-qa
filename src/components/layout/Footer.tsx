import { ExternalLink, ShieldCheck } from "lucide-react";
import { useHealth } from "../../hooks/useHealth.ts";
import { Badge } from "../ui/Badge.tsx";
import { CONTAINER } from "../../lib/layout.ts";

const REPO_URL = "https://github.com/AaronStark1/specshield-qa";

export function Footer() {
  const { health, error } = useHealth();
  const modeChip = error ? (
    <Badge tone="red" mono dot label="API offline">API OFFLINE</Badge>
  ) : !health ? (
    <Badge tone="gray" mono dot="pulse" label="Probing local API">PROBING</Badge>
  ) : health.mode === "gemma" ? (
    <Badge tone="emerald" mono dot label="Local Gemma inference active">LOCAL GEMMA</Badge>
  ) : (
    <Badge tone="amber" mono dot label="Deterministic fallback active">FALLBACK</Badge>
  );

  return (
    <footer className="mt-auto border-t border-edge">
      <div className={`${CONTAINER} flex flex-wrap items-center gap-x-4 gap-y-2 py-3 font-mono text-2xs text-fg-dim`}>
        <span className="inline-flex items-center gap-1.5 text-fg-muted">
          <ShieldCheck size={12} className="text-emerald-400" aria-hidden /> SpecShield QA
        </span>
        {modeChip}
        <span>Gemma via Ollama · Mastra workflow · Sentry agent tracing</span>
        <span className="hidden sm:inline">runs persist to data/runs.json on the API host</span>
        <nav aria-label="Project links" className="ml-auto flex flex-wrap items-center gap-3">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted transition-colors hover:text-fg">
            GitHub <ExternalLink size={11} aria-hidden />
          </a>
          <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted transition-colors hover:text-fg">
            MIT license <ExternalLink size={11} aria-hidden />
          </a>
        </nav>
      </div>
    </footer>
  );
}
