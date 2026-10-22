import { useId, useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { Calculator, ChevronRight, Info } from "lucide-react";
import { computeRoi } from "@shared/roi.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { clampNumber, formatHours, formatNumber, formatTokens, formatUsd, formatUsdSmart } from "../../lib/format.ts";
import { modeTone, tokenTotals } from "../../lib/runs.ts";
import { Badge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { Panel } from "../ui/Panel.tsx";
import { Tooltip } from "../ui/Tooltip.tsx";

const RATE_MAX = 10_000;
const MINUTES_MAX = 600;
const MTOK_MAX = 1_000;

interface NumberFieldProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (n: number) => void;
}

/**
 * Numeric input with a local draft so the field can be emptied while typing without
 * the store snapping it back. Commits every parseable value (clamped); an empty or
 * unparseable draft keeps the previous store value and is restored on blur.
 */
function NumberField({ label, unit, value, min, max, step = 1, onCommit }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1 flex items-baseline justify-between gap-2 font-mono text-2xs uppercase tracking-wider text-fg-dim">
        <span className="truncate">{label}</span>
        <span className="shrink-0 normal-case tracking-normal text-fg-faint">{unit}</span>
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw.trim() === "") return;
          const n = Number(raw);
          if (Number.isFinite(n)) onCommit(clampNumber(n, min, max, value));
        }}
        onBlur={() => setDraft(null)}
        className="field tabular"
      />
    </label>
  );
}

interface MetricProps {
  label: string;
  value: string;
  footnote: ReactNode;
  tone?: "emerald" | "default";
  badge?: ReactNode;
}

function Metric({ label, value, footnote, tone = "default", badge }: MetricProps) {
  return (
    <div className="min-w-0 rounded-md border border-edge bg-black/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 font-mono text-2xs uppercase leading-tight tracking-wider text-fg-dim">{label}</span>
        {badge}
      </div>
      <div className={clsx("tabular mt-1 truncate text-lg font-semibold leading-tight", tone === "emerald" ? "text-emerald-300" : "text-fg")}>
        {value}
      </div>
      <div className="mt-0.5 text-2xs leading-snug text-fg-dim" title={typeof footnote === "string" ? footnote : undefined}>{footnote}</div>
    </div>
  );
}

/** Agency ROI estimate, recomputed locally from the current run with the editable assumptions below. */
export function RoiCalculator() {
  const currentRun = usePipelineStore((s) => s.currentRun);
  const hourlyRate = usePipelineStore((s) => s.hourlyRate);
  const minutesPerTest = usePipelineStore((s) => s.minutesPerTest);
  const cloudIn = usePipelineStore((s) => s.cloudInputUsdPerMTok);
  const cloudOut = usePipelineStore((s) => s.cloudOutputUsdPerMTok);
  const setHourlyRate = usePipelineStore((s) => s.setHourlyRate);
  const setMinutesPerTest = usePipelineStore((s) => s.setMinutesPerTest);
  const setCloudRates = usePipelineStore((s) => s.setCloudRates);

  // Defensive: the store should already hold finite numbers, but never let NaN reach computeRoi.
  const rate = clampNumber(hourlyRate, 0, RATE_MAX, 85);
  const minutes = clampNumber(minutesPerTest, 0, MINUTES_MAX, 12);
  const inRate = clampNumber(cloudIn, 0, MTOK_MAX, 3);
  const outRate = clampNumber(cloudOut, 0, MTOK_MAX, 15);

  const testCases = currentRun?.testCases?.length ?? 0;
  const pageObjects = currentRun?.playwright?.pageObjects?.length ?? 0;
  const telemetry = useMemo(() => currentRun?.telemetry ?? [], [currentRun]);

  const roi = useMemo(() => {
    if (!currentRun) return null;
    // Mirrors server/routes/run.ts: prompt chars = spec + every agent prompt; output chars = generated code.
    const promptChars = (currentRun.specChars ?? 0) + telemetry.reduce((s, t) => s + (t.promptChars ?? 0), 0);
    const outputChars = (currentRun.playwright?.combinedCode ?? "").length + (currentRun.playwright?.specCode ?? "").length;
    return computeRoi(
      testCases,
      pageObjects,
      telemetry,
      { hourlyRateUsd: rate, manualMinutesPerTestCase: minutes, cloudInputUsdPerMTok: inRate, cloudOutputUsdPerMTok: outRate },
      { promptChars, outputChars }
    );
  }, [currentRun, telemetry, testCases, pageObjects, rate, minutes, inRate, outRate]);

  const tokens = tokenTotals(telemetry);
  const tokensReported = roi !== null && tokens.reported;
  const noRun = "run the pipeline";

  const methodology = (
    <div className="space-y-1.5">
      <p className="font-mono text-2xs uppercase tracking-wider text-fg-dim">Methodology</p>
      <ul className="list-disc space-y-1 pl-3.5 text-fg-muted">
        <li>
          Hours saved = (test cases × {formatNumber(minutes)} min + page objects × 25 min + 45 min review) ÷ 60, floored at 1.0 h.
        </li>
        <li>Billable value = hours × ${formatNumber(rate)}/hr.</li>
        <li>
          Cloud cost avoided = input tokens × ${formatNumber(inRate, 2)}/MTok + output tokens × ${formatNumber(outRate, 2)}/MTok. Cloud
          rates are illustrative comparison assumptions you can edit, not current list prices.
        </li>
        <li>
          Tokens come from Ollama usage when the run reports them; otherwise they are estimated as characters ÷ 4 (prompt + generated
          code) and labelled “est.”.
        </li>
        <li>“$0.00” is cloud API spend only. It excludes electricity, hardware and your own time.</li>
      </ul>
    </div>
  );

  return (
    <Panel
      title="Agency ROI"
      subtitle="estimate"
      icon={<Calculator size={14} />}
      actions={
        <Tooltip content={methodology} wide side="bottom" align="end">
          <Button variant="ghost" size="sm" icon={<Info size={13} />} aria-label="ROI methodology and assumptions">
            Method
          </Button>
        </Tooltip>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
          <NumberField label="Hourly rate" unit="$/hr" value={rate} min={0} max={RATE_MAX} onCommit={setHourlyRate} />
          <NumberField label="Manual minutes" unit="per test" value={minutes} min={0} max={MINUTES_MAX} onCommit={setMinutesPerTest} />
        </div>

        <details className="group rounded-md border border-edge bg-black/20">
          <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 px-3 py-2 font-mono text-2xs uppercase tracking-wider text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <ChevronRight size={12} className="shrink-0 transition-transform duration-150 group-open:rotate-90" aria-hidden />
            Cloud comparison rates
            <span className="tabular ml-auto normal-case tracking-normal text-fg-dim">
              ${formatNumber(inRate, 2)} in · ${formatNumber(outRate, 2)} out /MTok
            </span>
          </summary>
          <div className="grid grid-cols-2 gap-2 border-t border-edge px-3 py-2.5 max-[360px]:grid-cols-1">
            <NumberField label="Input" unit="$/MTok" value={inRate} min={0} max={MTOK_MAX} step={0.01} onCommit={(n) => setCloudRates(n, outRate)} />
            <NumberField label="Output" unit="$/MTok" value={outRate} min={0} max={MTOK_MAX} step={0.01} onCommit={(n) => setCloudRates(inRate, n)} />
            <p className="col-span-full text-2xs text-fg-dim">
              Illustrative assumptions for the comparison only; not current list prices of any provider.
            </p>
          </div>
        </details>

        <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs text-fg-muted">
          {currentRun ? (
            <>
              <span>
                {formatNumber(testCases)} test case{testCases === 1 ? "" : "s"} · {formatNumber(pageObjects)} page object
                {pageObjects === 1 ? "" : "s"} from the current run
              </span>
              <Badge tone={modeTone(currentRun.mode)} mono size="xs" title={`Run mode: ${currentRun.mode}`}>
                {currentRun.mode}
              </Badge>
            </>
          ) : (
            <span>No run loaded</span>
          )}
        </p>

        <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
          <Metric
            label="Hours saved"
            value={roi ? formatHours(roi.estimatedManualHours) : "—"}
            footnote={roi ? "manual authoring estimate" : noRun}
          />
          <Metric
            label="Billable value"
            value={roi ? formatUsd(roi.billableValueUsd) : "—"}
            tone={roi ? "emerald" : "default"}
            footnote={roi ? "hours × rate" : noRun}
          />
          <Metric
            label="Cloud cost avoided"
            value={roi ? formatUsdSmart(roi.cloudEquivalentCostUsd) : "—"}
            badge={
              roi ? (
                <Badge
                  tone={tokensReported ? "emerald" : "amber"}
                  size="xs"
                  title={tokensReported ? "Token counts reported by Ollama usage" : "Tokens estimated as characters ÷ 4"}
                >
                  {tokensReported ? "reported tokens" : "est. tokens"}
                </Badge>
              ) : undefined
            }
            footnote={
              roi ? (
                <>
                  {tokensReported ? "" : "≈ "}in {formatTokens(roi.totalInputTokens)} / out {formatTokens(roi.totalOutputTokens)} tokens
                </>
              ) : (
                noRun
              )
            }
          />
          <Metric
            label="Local inference"
            value={roi ? "$0.00" : "—"}
            tone={roi ? "emerald" : "default"}
            footnote={roi ? "API spend only · excl. electricity & hardware" : noRun}
          />
        </div>
      </div>
    </Panel>
  );
}
