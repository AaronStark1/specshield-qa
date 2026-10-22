import { useCallback } from "react";
import { runPipeline } from "../lib/sse.ts";
import { fetchRuns } from "../lib/api.ts";
import { usePipelineStore } from "../state/pipelineStore.ts";
import type { PipelineEvent } from "@shared/types.js";

export const MIN_SPEC_CHARS = 80;
const STEP_ORDER = ["requirementParser", "qaMatrixArchitect", "playwrightCodegen"] as const;
const STEP_NAMES = ["Requirement Parser", "QA Matrix Architect", "Playwright Codegen"] as const;

export function canRunSpec(spec: string): boolean {
  return spec.trim().length >= MIN_SPEC_CHARS;
}

// Module-level so Cancel works from any component, not only the one that started the run.
let activeController: AbortController | null = null;

export function usePipeline(): { run: () => Promise<void>; cancel: () => void } {

  const run = useCallback(async () => {
    const st = usePipelineStore.getState();
    if (st.running || !canRunSpec(st.spec)) return;
    const ctrl = new AbortController();
    activeController = ctrl;
    st.setRunning(true);
    st.setLastError(null);
    st.setRunStartedAt(Date.now());
    st.setActiveTab("matrix");
    const base = Date.now();
    st.setSteps(
      STEP_ORDER.map((step, i) => ({
        step,
        agentName: STEP_NAMES[i] ?? "",
        status: "pending" as const,
        mode: "fallback" as const,
        startedAt: base,
        model: "",
        promptChars: 0,
        inputTokens: 0,
        outputTokens: 0,
      }))
    );
    try {
      await runPipeline(
        st.spec,
        st.title,
        (ev: PipelineEvent) => {
          const s = usePipelineStore.getState();
          if (ev.type === "pipeline:start") {
            s.setSteps(s.steps.map((x) => ({ ...x, mode: ev.mode, model: ev.model })));
          } else if (ev.type === "step:progress") {
            s.setSteps(
              s.steps.map((x) =>
                x.step === ev.step
                  ? { ...x, progress: { outputTokens: ev.outputTokens, tokensPerSecond: ev.tokensPerSecond } }
                  : x
              )
            );
          } else if (ev.type === "step:start" || ev.type === "step:end") {
            s.setSteps(s.steps.map((x) => (x.step === ev.step.step ? { ...ev.step } : x)));
          } else if (ev.type === "pipeline:end") {
            s.setCurrentRun(ev.record);
            s.setSteps(ev.record.telemetry);
            void fetchRuns()
              .then((h) => {
                usePipelineStore.getState().setHistory(h);
                usePipelineStore.getState().setHistoryStatus("ready");
              })
              .catch(() => {
                // history refresh is best-effort
              });
          } else if (ev.type === "error") {
            s.setLastError(ev.message);
            s.setSteps(s.steps.map((x) => (x.status === "running" ? { ...x, status: "error" as const, error: ev.message } : x)));
          }
        },
        ctrl.signal
      );
    } catch (e) {
      const err = e as Error;
      const s = usePipelineStore.getState();
      if (err.name === "AbortError") {
        s.setLastError("Run cancelled");
        s.setSteps(s.steps.map((x) => (x.status === "running" || x.status === "pending" ? { ...x, status: "error" as const, error: "cancelled" } : x)));
      } else {
        s.setLastError(err.message || "Pipeline request failed");
        console.error(e);
      }
    } finally {
      usePipelineStore.getState().setRunning(false);
      activeController = null;
    }
  }, []);

  const cancel = useCallback(() => activeController?.abort(), []);
  return { run, cancel };
}
