import { clsx } from "clsx";
import { Lock, TriangleAlert } from "lucide-react";
import { useHealth } from "../../hooks/useHealth.ts";
import { useOutboundAudit } from "../../hooks/useOutboundAudit.ts";

interface Fact {
  value: string;
  label: string;
  warn?: boolean;
}

/**
 * The privacy receipt. "0 Outbound Packets" is measured, not asserted: it reflects this browser
 * tab's own network activity since the studio opened, and the receipt switches to a warning when
 * the local server reports that diagnostics tracing is switched on.
 */
export function PrivacyBadge() {
  const { health, error } = useHealth();
  const audit = useOutboundAudit();
  const tracing = health?.sentryEnabled === true;
  const leaking = audit.externalRequests > 0;
  const warn = tracing || leaking;

  const outbound: Fact = leaking
    ? { value: String(audit.externalRequests), label: `External Request${audit.externalRequests === 1 ? "" : "s"}`, warn: true }
    : tracing
      ? { value: "Tracing On", label: "Diagnostics Leave This Machine", warn: true }
      : { value: "0", label: "Outbound Packets" };
  const facts: Fact[] = [outbound, { value: "$0.00", label: "Cloud Cost" }];

  return (
    <section
      aria-label="Privacy"
      className={clsx("panel min-w-0 px-4 py-3", warn ? "border-amber-500/30" : "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-transparent")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
          <span
            aria-hidden
            className={clsx(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
              warn ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
            )}
          >
            {warn ? <TriangleAlert size={14} /> : <Lock size={14} />}
          </span>
          {warn ? "Local-First" : "Air-Gapped"}
        </h2>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline gap-1.5 border-l border-edge-strong pl-4">
              <dd className={clsx("tabular text-[15px] font-semibold", fact.warn ? "text-amber-300" : "text-emerald-300")}>{fact.value}</dd>
              <dt className="text-xs text-fg-muted">{fact.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {tracing && (
        <p className="mt-3 text-xs leading-relaxed text-amber-200/90">
          Diagnostics tracing is switched on for this server, so run timings (and prompt previews, unless disabled) are sent to Sentry. Remove{" "}
          <code className="font-mono text-amber-100">SENTRY_DSN</code> from <code className="font-mono text-amber-100">.env</code> and restart to
          run fully air-gapped.
        </p>
      )}
      {leaking && !tracing && (
        <p className="mt-3 text-xs leading-relaxed text-amber-200/90">This tab contacted a host other than the local studio since it opened.</p>
      )}
      {error && <p className="mt-3 text-xs leading-relaxed text-fg-dim">The local API is offline, so server-side settings cannot be confirmed right now.</p>}
    </section>
  );
}
