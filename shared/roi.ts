import type { RoiAssumptions, RoiEstimate, TelemetryStep } from "./types.js";

export function computeRoi(
  testCases: number,
  pageObjects: number,
  telemetry: TelemetryStep[],
  assumptions: RoiAssumptions,
  opts?: { promptChars?: number; outputChars?: number }
): RoiEstimate {
  const estimatedManualHours =
    Math.round(
      Math.max(
        1,
        (testCases * assumptions.manualMinutesPerTestCase + pageObjects * 25 + 45) / 60
      ) * 10
    ) / 10;
  const billableValueUsd = Math.round(estimatedManualHours * assumptions.hourlyRateUsd * 100) / 100;

  let totalInputTokens = telemetry.reduce((s, t) => s + (t.inputTokens ?? 0), 0);
  let totalOutputTokens = telemetry.reduce((s, t) => s + (t.outputTokens ?? 0), 0);

  // When the run was in fallback mode and tokens are 0, estimate tokens as
  // promptChars/4 + outputChars/4 so the comparison is still meaningful.
  if (totalInputTokens === 0 && totalOutputTokens === 0) {
    const promptChars = opts?.promptChars ?? telemetry.reduce((s, t) => s + (t.promptChars ?? 0), 0);
    const outputChars = opts?.outputChars ?? testCases * 420 + pageObjects * 1800;
    totalInputTokens = Math.round(promptChars / 4);
    totalOutputTokens = Math.round(outputChars / 4);
  }

  const cloudEquivalentCostUsd =
    Math.round(
      ((totalInputTokens / 1e6) * assumptions.cloudInputUsdPerMTok +
        (totalOutputTokens / 1e6) * assumptions.cloudOutputUsdPerMTok) *
        100
    ) / 100;

  const pipelineSeconds =
    Math.round((telemetry.reduce((s, t) => s + (t.durationMs ?? 0), 0) / 1000) * 10) / 10;

  return {
    testCaseCount: testCases,
    pageObjectCount: pageObjects,
    estimatedManualHours,
    hourlyRateUsd: assumptions.hourlyRateUsd,
    billableValueUsd,
    totalInputTokens,
    totalOutputTokens,
    cloudEquivalentCostUsd,
    localCostUsd: 0,
    pipelineSeconds,
  };
}

export function defaultAssumptions(env?: {
  ROI_HOURLY_RATE_USD?: string;
  ROI_MANUAL_MINUTES_PER_TEST_CASE?: string;
  ROI_CLOUD_INPUT_USD_PER_MTOK?: string;
  ROI_CLOUD_OUTPUT_USD_PER_MTOK?: string;
}): RoiAssumptions {
  return {
    hourlyRateUsd: Number(env?.ROI_HOURLY_RATE_USD ?? 85),
    manualMinutesPerTestCase: Number(env?.ROI_MANUAL_MINUTES_PER_TEST_CASE ?? 12),
    cloudInputUsdPerMTok: Number(env?.ROI_CLOUD_INPUT_USD_PER_MTOK ?? 3),
    cloudOutputUsdPerMTok: Number(env?.ROI_CLOUD_OUTPUT_USD_PER_MTOK ?? 15),
  };
}
