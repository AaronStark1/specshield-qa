import { Header } from "./components/layout/Header.tsx";
import { Footer } from "./components/layout/Footer.tsx";
import { PrivacyBadge } from "./components/layout/PrivacyBadge.tsx";
import { RoiCalculator } from "./components/layout/RoiCalculator.tsx";
import { SpecEditor } from "./components/editor/SpecEditor.tsx";
import { PipelineProgress } from "./components/pipeline/PipelineProgress.tsx";
import { WorkspaceTabs } from "./components/workspace/WorkspaceTabs.tsx";
import { usePipelineStore } from "./state/pipelineStore.ts";
import { useRuns } from "./hooks/useRuns.ts";
import { CONTAINER } from "./lib/layout.ts";

export default function App() {
  const steps = usePipelineStore((s) => s.steps);
  const running = usePipelineStore((s) => s.running);
  const runStartedAt = usePipelineStore((s) => s.runStartedAt);
  const lastError = usePipelineStore((s) => s.lastError);
  useRuns();

  return (
    <div className="flex min-h-screen flex-col text-fg">
      <Header />
      <main
        className={`${CONTAINER} grid flex-1 content-start gap-4 py-4 lg:grid-cols-[minmax(0,38fr)_minmax(0,62fr)] 2xl:grid-cols-[minmax(0,34fr)_minmax(0,66fr)]`}
      >
        <section aria-label="Specification, ROI and privacy" className="flex min-w-0 flex-col gap-4">
          <SpecEditor />
          <RoiCalculator />
          <PrivacyBadge />
        </section>
        <section aria-label="Agent pipeline and generated output" className="flex min-w-0 flex-col gap-4">
          <PipelineProgress steps={steps} running={running} runStartedAt={runStartedAt} error={lastError} />
          <WorkspaceTabs />
        </section>
      </main>
      <Footer />
    </div>
  );
}
