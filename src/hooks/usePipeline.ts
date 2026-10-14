import { useCallback, useRef } from "react";
import { runPipeline } from "../lib/sse.ts";
import { usePipelineStore } from "../state/pipelineStore.ts";
import type { PipelineEvent } from "@shared/types.js";

const STEP_ORDER = ["requirementParser", "qaMatrixArchitect", "playwrightCodegen"] as const;

export function usePipeline(): { run: () => Promise<void>; cancel: () => void } {
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    const st = usePipelineStore.getState();
    if (st.running || st.spec.trim().length < 80) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    st.setRunning(true);
    st.setActiveTab("matrix");
    const base = Date.now();
    st.setSteps(
      STEP_ORDER.map((step, i) => ({
        step,
        agentName: ["Requirement Parser", "QA Matrix Architect", "Playwright Codegen"][i]!,
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
      await runPipeline(st.spec, st.title, (ev: PipelineEvent) => {
        const s = usePipelineStore.getState();
        if (ev.type === "step:progress") {
          s.setSteps(
            s.steps.map((x) =>
              x.step === ev.step
                ? {
                    ...x,
                    progress: { outputTokens: ev.outputTokens, tokensPerSecond: ev.tokensPerSecond },
                  }
                : x
            )
          );
        } else if (ev.type === "step:start") {
          s.setSteps(s.steps.map((x) => (x.step === ev.step.step ? { ...ev.step } : x)));
        } else if (ev.type === "step:end") {
          s.setSteps(s.steps.map((x) => (x.step === ev.step.step ? { ...ev.step } : x)));
        } else if (ev.type === "pipeline:end") {
          s.setCurrentRun(ev.record);
          s.setSteps(ev.record.telemetry);
          // refresh history lazily
          void import("../lib/api.ts").then(async ({ fetchRuns }) => {
            try {
              const h = await fetchRuns();
              usePipelineStore.getState().setHistory(h);
            } catch {
              // ignore
            }
          });
        } else if (ev.type === "error") {
          console.error("pipeline error", ev.message);
        }
      }, ctrl.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      usePipelineStore.getState().setRunning(false);
      abort.current = null;
    }
  }, []);

  const cancel = useCallback(() => abort.current?.abort(), []);
  return { run, cancel };
}
