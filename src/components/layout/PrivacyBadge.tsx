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
 * The one privacy card. "0 bytes outbound" is measured, not asserted: it reflects this browser
 * tab's own network activity since the studio opened, and the card switches to a warning when the
 * local server reports that diagnostics tracing is switched on.
 */
export function PrivacyBadge() {
  const { health, error } = useHealth();
  const audit = useOutboundAudit();
  const tracing = health?.sentryEnabled === true;
  const leaking = audit.externalRequests > 0;
  const warn = tracing || leaking;

  const outbound: Fact = leaking
    ? { value: `${audit.externalRequests} external request${audit.externalRequests === 1 ? "" : "s"}`, label: "from this tab", warn: true }
    : tracing
      ? { value: "Tracing on", label: "diagnostics leave this machine", warn: true }
      : { value: "0 bytes", label: "outbound" };

  const facts: Fact[] = [outbound, { value: "$0.00", label: "API cost" }, { value: "Local-First", label: "execution" }];

  return (
    <section
      aria-label="Privacy"
      className={clsx("panel min-w-0 p-4", warn ? "border-amber-500/30" : "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-transparent")}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            warn ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
          )}
        >
          {warn ? <TriangleAlert size={15} /> : <Lock size={15} />}
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-fg">{warn ? "Local-First Privacy" : "Air-Gapped Privacy"}</h2>
      </div>

      <dl className="mt-3 grid grid-cols-3 divide-x divide-edge">
        {facts.map((fact) => (
          <div key={fact.label} className="flex min-w-0 flex-col-reverse px-3 first:pl-0 last:pr-0">
            <dt className="truncate text-[11px] text-fg-dim">{fact.label}</dt>
            <dd className={clsx("tabular truncate text-[15px] font-semibold", fact.warn ? "text-amber-300" : "text-emerald-300")}>{fact.value}</dd>
          </div>
        ))}
      </dl>

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
