import { useEffect } from "react";
import { Header } from "./components/layout/Header.tsx";
import { PrivacyBadge } from "./components/layout/PrivacyBadge.tsx";
import { RoiCalculator } from "./components/layout/RoiCalculator.tsx";
import { SpecEditor } from "./components/editor/SpecEditor.tsx";
import { LoadSampleButton, RunControls } from "./components/editor/LoadSampleButton.tsx";
import { PipelineProgress } from "./components/pipeline/PipelineProgress.tsx";
import { WorkspaceTabs } from "./components/workspace/WorkspaceTabs.tsx";
import { usePipelineStore } from "./state/pipelineStore.ts";
import { usePipeline } from "./hooks/usePipeline.ts";
import { useRuns } from "./hooks/useRuns.ts";

export default function App() {
  const { steps } = usePipelineStore();
  const { run } = usePipeline();
  useRuns();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-[#e5e7eb]">
      <Header />
      <main className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 lg:grid-cols-[40%_60%]">
        <section className="space-y-4">
          <div className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
            <SpecEditor />
            <div className="mt-3 flex flex-wrap gap-2">
              <LoadSampleButton />
            </div>
            <RunControls />
          </div>
          <RoiCalculator />
          <PrivacyBadge />
        </section>
        <section className="space-y-4">
          <div className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#9ca3af]">Pipeline — 3 agents</h2>
            <PipelineProgress steps={steps} />
          </div>
          <div className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
            <WorkspaceTabs />
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-[1500px] px-4 pb-6 font-mono text-[11px] text-[#6b7280]">
        SpecShield QA · local-first · Gemma via Ollama · Mastra + Sentry tracing · runs in ./data/runs.json
      </footer>
    </div>
  );
}
