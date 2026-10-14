import { useMemo } from "react";
import { computeRoi } from "@shared/roi.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { formatUsd } from "../../lib/format.ts";

export function RoiCalculator() {
  const { currentRun, steps, hourlyRate, minutesPerTest, setHourlyRate, setMinutesPerTest } = usePipelineStore();
  const roi = useMemo(() => {
    const tc = currentRun?.testCases.length ?? 0;
    const po = currentRun?.playwright.pageObjects.length ?? 0;
    const tel = currentRun?.telemetry ?? steps;
    if (tc === 0) return null;
    return computeRoi(tc, po, tel, {
      hourlyRateUsd: hourlyRate,
      manualMinutesPerTestCase: minutesPerTest,
      cloudInputUsdPerMTok: 3,
      cloudOutputUsdPerMTok: 15,
    }, { promptChars: currentRun?.specChars ?? 8000, outputChars: (currentRun?.playwright.combinedCode.length ?? 20000) });
  }, [currentRun, steps, hourlyRate, minutesPerTest]);

  const est = currentRun && currentRun.telemetry.every((t) => t.inputTokens === 0 && t.outputTokens === 0);

  return (
    <section className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
      <h3 className="text-sm font-semibold">ROI calculator</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-[#9ca3af]">
          Hourly rate ($)
          <input type="number" value={hourlyRate} min={1} onChange={(e) => setHourlyRate(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-[#1f2937] bg-black/30 px-2 py-1.5 text-sm text-white" />
        </label>
        <label className="text-xs text-[#9ca3af]">
          Min / test
          <input type="number" value={minutesPerTest} min={1} onChange={(e) => setMinutesPerTest(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-[#1f2937] bg-black/30 px-2 py-1.5 text-sm text-white" />
        </label>
      </div>
      {roi ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between"><dt className="text-[#9ca3af]">Hours saved</dt><dd className="font-semibold">{roi.estimatedManualHours}h</dd></div>
          <div className="flex justify-between"><dt className="text-[#9ca3af]">Billable value</dt><dd className="font-semibold text-emerald-300">{formatUsd(roi.billableValueUsd)}</dd></div>
          <div className="flex justify-between"><dt className="text-[#9ca3af]">Cloud API cost avoided {est ? "(est.)" : ""}</dt><dd className="font-semibold">{formatUsd(roi.cloudEquivalentCostUsd)}</dd></div>
          <div className="flex justify-between"><dt className="text-[#9ca3af]">Local inference cost</dt><dd className="font-semibold text-emerald-400">$0.00</dd></div>
          <div className="flex justify-between"><dt className="text-[#9ca3af]">Tokens in/out</dt><dd className="font-mono">{roi.totalInputTokens.toLocaleString()} / {roi.totalOutputTokens.toLocaleString()}</dd></div>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-[#9ca3af]">Run the pipeline to see hours saved, billable value and cloud cost avoided.</p>
      )}
    </section>
  );
}
