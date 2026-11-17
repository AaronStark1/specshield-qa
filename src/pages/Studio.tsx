import { useEffect } from "react";
import { AmbientVideo } from "../components/layout/AmbientVideo.tsx";
import { Header } from "../components/layout/Header.tsx";
import { Footer } from "../components/layout/Footer.tsx";
import { PrivacyBadge } from "../components/layout/PrivacyBadge.tsx";
import { RoiCalculator } from "../components/layout/RoiCalculator.tsx";
import { SpecEditor } from "../components/editor/SpecEditor.tsx";
import { PipelineProgress } from "../components/pipeline/PipelineProgress.tsx";
import { WorkspaceTabs } from "../components/workspace/WorkspaceTabs.tsx";
import { usePipelineStore } from "../state/pipelineStore.ts";
import { useRuns } from "../hooks/useRuns.ts";
import { CONTAINER } from "../lib/layout.ts";
import { findSample, loadSample } from "../lib/samples.ts";

const PAGE_TITLE = "SpecShield QA — Studio";

/** `/studio?sample=<id>` opens the studio with that sample already in the editor. */
function useSampleFromUrl(): void {
  useEffect(() => {
    const sample = findSample(new URLSearchParams(window.location.search).get("sample"));
    if (!sample) return;
    if (usePipelineStore.getState().spec.trim().length === 0) loadSample(sample);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
}

export default function Studio() {
  const steps = usePipelineStore((s) => s.steps);
  const running = usePipelineStore((s) => s.running);
  const runStartedAt = usePipelineStore((s) => s.runStartedAt);
  const lastError = usePipelineStore((s) => s.lastError);
  useRuns();
  useSampleFromUrl();

  useEffect(() => {
    document.title = PAGE_TITLE;
  }, []);

  return (
    <div className="studio-shell relative isolate flex min-h-screen flex-col text-fg">
      <AmbientVideo />
      <Header />
      <main className={`${CONTAINER} relative z-[1] grid flex-1 content-start gap-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`}>
        <section aria-label="Specification" className="flex min-w-0 flex-col gap-4">
          <SpecEditor />
          <PrivacyBadge />
          <RoiCalculator />
        </section>
        <section aria-label="Generated output" className="flex min-w-0 flex-col gap-4">
          <PipelineProgress steps={steps} running={running} runStartedAt={runStartedAt} error={lastError} />
          <WorkspaceTabs />
        </section>
      </main>
      <Footer />
    </div>
  );
}
