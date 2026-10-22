import { create } from "zustand";
import type { RunRecord, TelemetryStep } from "@shared/types.js";

export type WorkspaceTab = "matrix" | "playwright" | "telemetry" | "history";
export type HistoryStatus = "idle" | "loading" | "ready" | "error";

interface PipelineState {
  spec: string;
  title: string;
  running: boolean;
  /** Epoch ms when the current run was started from this UI; null when idle or viewing history. */
  runStartedAt: number | null;
  /** Last pipeline error message (SSE error event, HTTP failure, or cancellation). */
  lastError: string | null;
  currentRun: RunRecord | null;
  steps: TelemetryStep[];
  history: RunRecord[];
  historyStatus: HistoryStatus;
  historyError: string | null;
  activeTab: WorkspaceTab;
  hourlyRate: number;
  minutesPerTest: number;
  /** Illustrative cloud comparison rates (USD per million tokens) — editable assumptions, not live prices. */
  cloudInputUsdPerMTok: number;
  cloudOutputUsdPerMTok: number;
  /** Incremented on a global Esc press; components subscribe to dismiss transient UI. */
  escapeTick: number;
  setSpec: (s: string) => void;
  setTitle: (t: string) => void;
  setRunning: (b: boolean) => void;
  setRunStartedAt: (t: number | null) => void;
  setLastError: (m: string | null) => void;
  setCurrentRun: (r: RunRecord | null) => void;
  setSteps: (s: TelemetryStep[]) => void;
  setHistory: (h: RunRecord[]) => void;
  setHistoryStatus: (s: HistoryStatus, error?: string | null) => void;
  setActiveTab: (t: WorkspaceTab) => void;
  setHourlyRate: (n: number) => void;
  setMinutesPerTest: (n: number) => void;
  setCloudRates: (input: number, output: number) => void;
  bumpEscape: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  spec: "",
  title: "",
  running: false,
  runStartedAt: null,
  lastError: null,
  currentRun: null,
  steps: [],
  history: [],
  historyStatus: "idle",
  historyError: null,
  activeTab: "matrix",
  hourlyRate: 85,
  minutesPerTest: 12,
  cloudInputUsdPerMTok: 3,
  cloudOutputUsdPerMTok: 15,
  escapeTick: 0,
  setSpec: (spec) => set({ spec }),
  setTitle: (title) => set({ title }),
  setRunning: (running) => set({ running }),
  setRunStartedAt: (runStartedAt) => set({ runStartedAt }),
  setLastError: (lastError) => set({ lastError }),
  setCurrentRun: (currentRun) => set({ currentRun }),
  setSteps: (steps) => set({ steps }),
  setHistory: (history) => set({ history }),
  setHistoryStatus: (historyStatus, historyError = null) => set({ historyStatus, historyError }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setHourlyRate: (hourlyRate) => set({ hourlyRate }),
  setMinutesPerTest: (minutesPerTest) => set({ minutesPerTest }),
  setCloudRates: (cloudInputUsdPerMTok, cloudOutputUsdPerMTok) => set({ cloudInputUsdPerMTok, cloudOutputUsdPerMTok }),
  bumpEscape: () => set((s) => ({ escapeTick: s.escapeTick + 1 })),
}));
