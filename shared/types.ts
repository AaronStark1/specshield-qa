export type AgentMode = "gemma" | "fallback";
export type TestCategory = "Functional" | "Boundary" | "Negative" | "Security";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type StepId = "requirementParser" | "qaMatrixArchitect" | "playwrightCodegen";

export interface ParsedRequirements {
  title: string;
  summary: string;
  roles: { name: string; description: string }[];
  features: { id: string; name: string; description: string; roles: string[] }[];
  acceptanceCriteria: { id: string; featureId: string; text: string }[];
  fields: { name: string; type: string; required: boolean; constraints: string[]; featureId: string }[];
  validationRules: { id: string; rule: string; featureId: string }[];
  securitySurfaces: string[];
}

export interface TestCase {
  id: string;                       // "FIT-FUNC-001", "FIT-BND-004", "FIT-NEG-002", "FIT-SEC-003"
  featureId: string;
  category: TestCategory;
  title: string;
  given: string;
  when: string;
  then: string;
  priority: Priority;
  expectedResult: string;
  tags: string[];
}

export interface PlaywrightSuite {
  fileName: string;                 // "invoice-tracker.spec.ts"
  pageObjects: { className: string; fileName: string; code: string }[];
  specCode: string;                 // the .spec.ts importing POMs from ./pages/*
  combinedCode: string;             // single-file version: POM classes inlined above the tests
  coverage: { testCaseId: string; testName: string }[];
}

export interface TelemetryStep {
  step: StepId;
  agentName: string;
  status: "pending" | "running" | "success" | "fallback" | "error";
  mode: AgentMode;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  model: string;
  promptChars: number;
  inputTokens: number;
  outputTokens: number;
  sentryTraceId?: string;
  sentrySpanId?: string;
  error?: string;
  codegenStrategy?: string;
  progress?: { outputTokens: number; tokensPerSecond: number };
}

export interface RoiAssumptions {
  hourlyRateUsd: number;
  manualMinutesPerTestCase: number;
  cloudInputUsdPerMTok: number;
  cloudOutputUsdPerMTok: number;
}

export interface RoiEstimate {
  testCaseCount: number;
  pageObjectCount: number;
  estimatedManualHours: number;     // (testCases * minutesPerCase + pageObjects * 25 min + 45 min review) / 60, min 1.0
  hourlyRateUsd: number;
  billableValueUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cloudEquivalentCostUsd: number;
  localCostUsd: 0;
  pipelineSeconds: number;
}

export interface RunRecord {
  id: string;
  createdAt: string;                // ISO
  title: string;
  specHash: string;                 // sha256 hex, first 12 chars
  specChars: number;
  spec: string;
  mode: AgentMode | "mixed";
  model: string;
  requirements: ParsedRequirements;
  testCases: TestCase[];
  playwright: PlaywrightSuite;
  telemetry: TelemetryStep[];
  roi: RoiEstimate;
  sentryTraceId?: string;
}

export interface HealthResponse {
  ok: true;
  ollamaReachable: boolean;
  modelAvailable: boolean;
  model: string;
  baseUrl: string;
  mode: AgentMode;
  forcedFallback: boolean;
  sentryEnabled: boolean;
  availableModels: string[];
  contextLength: number | null;
  /** Newer API only: true once the Sentry SDK reports it initialised. Absent on older servers. */
  sentryInitialized?: boolean;
  /** Optional deep-link template containing "{traceId}"; null when not configured. */
  sentryTraceUrlTemplate?: string | null;
}

export type PipelineEvent =
  | { type: "pipeline:start"; runId: string; mode: AgentMode; model: string }
  | { type: "step:start"; runId: string; step: TelemetryStep }
  | { type: "step:progress"; runId: string; step: StepId; outputTokens: number; tokensPerSecond: number }
  | { type: "step:end"; runId: string; step: TelemetryStep; preview?: { label: string; value: string } }
  | { type: "pipeline:end"; runId: string; record: RunRecord }
  | { type: "error"; runId: string; message: string };
