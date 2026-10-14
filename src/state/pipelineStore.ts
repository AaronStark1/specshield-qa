import { create } from "zustand";
import type { RunRecord, TelemetryStep } from "@shared/types.js";

interface PipelineState {
  spec: string;
  title: string;
  running: boolean;
  currentRun: RunRecord | null;
  steps: TelemetryStep[];
  history: RunRecord[];
  activeTab: "matrix" | "playwright" | "telemetry" | "history";
  hourlyRate: number;
  minutesPerTest: number;
  setSpec: (s: string) => void;
  setTitle: (t: string) => void;
  setRunning: (b: boolean) => void;
  setCurrentRun: (r: RunRecord | null) => void;
  setSteps: (s: TelemetryStep[]) => void;
  setHistory: (h: RunRecord[]) => void;
  setActiveTab: (t: PipelineState["activeTab"]) => void;
  setHourlyRate: (n: number) => void;
  setMinutesPerTest: (n: number) => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  spec: "",
  title: "",
  running: false,
  currentRun: null,
  steps: [],
  history: [],
  activeTab: "matrix",
  hourlyRate: 85,
  minutesPerTest: 12,
  setSpec: (spec) => set({ spec }),
  setTitle: (title) => set({ title }),
  setRunning: (running) => set({ running }),
  setCurrentRun: (currentRun) => set({ currentRun }),
  setSteps: (steps) => set({ steps }),
  setHistory: (history) => set({ history }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setHourlyRate: (hourlyRate) => set({ hourlyRate }),
  setMinutesPerTest: (minutesPerTest) => set({ minutesPerTest }),
}));
