import { usePipelineStore } from "../../state/pipelineStore.ts";
import { Tabs, Tab } from "../ui/Tabs.tsx";
import { QaMatrixTab } from "./QaMatrixTab.tsx";
import { PlaywrightTab } from "./PlaywrightTab.tsx";
import { TelemetryDrawer } from "./TelemetryDrawer.tsx";
import { HistoryTab } from "./HistoryTab.tsx";

export function WorkspaceTabs() {
  const { activeTab, setActiveTab, currentRun, steps } = usePipelineStore();
  const cases = currentRun?.testCases ?? [];
  const suite = currentRun?.playwright ?? null;
  const telemetry = currentRun?.telemetry ?? steps;

  return (
    <div>
      <Tabs>
        <Tab active={activeTab === "matrix"} onClick={() => setActiveTab("matrix")}>1 QA Test Matrix {cases.length > 0 && `(${cases.length})`}</Tab>
        <Tab active={activeTab === "playwright"} onClick={() => setActiveTab("playwright")}>2 Playwright .spec.ts</Tab>
        <Tab active={activeTab === "telemetry"} onClick={() => setActiveTab("telemetry")}>3 Sentry Agent Telemetry</Tab>
        <Tab active={activeTab === "history"} onClick={() => setActiveTab("history")}>4 Local Run History</Tab>
      </Tabs>
      <div className="mt-3">
        {activeTab === "matrix" && <QaMatrixTab cases={cases} />}
        {activeTab === "playwright" && <PlaywrightTab suite={suite} />}
        {activeTab === "telemetry" && <TelemetryDrawer steps={telemetry} traceId={currentRun?.sentryTraceId} />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
