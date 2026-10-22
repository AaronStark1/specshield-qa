import type { ReactNode } from "react";
import { Activity, FileCode, History, Table2 } from "lucide-react";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { formatRelative } from "../../lib/format.ts";
import { modeTone } from "../../lib/runs.ts";
import { Badge } from "../ui/Badge.tsx";
import { Panel } from "../ui/Panel.tsx";
import { Tabs, Tab } from "../ui/Tabs.tsx";
import { QaMatrixTab } from "./QaMatrixTab.tsx";
import { PlaywrightTab } from "./PlaywrightTab.tsx";
import { TelemetryDrawer } from "./TelemetryDrawer.tsx";
import { HistoryTab } from "./HistoryTab.tsx";
import type { WorkspaceTab } from "../../state/pipelineStore.ts";

const TABS: { id: WorkspaceTab; label: string; icon: ReactNode }[] = [
  { id: "matrix", label: "QA matrix", icon: <Table2 size={13} /> },
  { id: "playwright", label: "Playwright", icon: <FileCode size={13} /> },
  { id: "telemetry", label: "Telemetry", icon: <Activity size={13} /> },
  { id: "history", label: "History", icon: <History size={13} /> },
];

export function WorkspaceTabs() {
  const { activeTab, setActiveTab, currentRun, steps, history, running, runStartedAt } = usePipelineStore();
  const cases = currentRun?.testCases ?? [];
  const suite = currentRun?.playwright ?? null;
  const telemetry = steps.length > 0 ? steps : (currentRun?.telemetry ?? []);
  const fileCount = suite ? 1 + suite.pageObjects.length : 0;
  const counts: Record<WorkspaceTab, number | undefined> = {
    matrix: cases.length || undefined,
    playwright: fileCount || undefined,
    telemetry: telemetry.filter((s) => s.status !== "pending").length || undefined,
    history: history.length || undefined,
  };

  return (
    <Panel
      flush
      title={
        <Tabs label="Workspace">
          {TABS.map((t) => (
            <Tab
              key={t.id}
              id={`tab-${t.id}`}
              controls={`panel-${t.id}`}
              active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              icon={t.icon}
              count={counts[t.id]}
            >
              {t.label}
            </Tab>
          ))}
        </Tabs>
      }
      actions={
        currentRun ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden max-w-[220px] truncate font-mono text-2xs text-fg-dim md:inline" title={currentRun.title}>
              {currentRun.title}
            </span>
            <Badge tone={modeTone(currentRun.mode)} mono size="xs" label={`Execution mode: ${currentRun.mode}`}>
              {currentRun.mode}
            </Badge>
            <span className="hidden font-mono text-2xs text-fg-dim sm:inline" title={currentRun.createdAt}>
              {formatRelative(currentRun.createdAt)}
            </span>
          </div>
        ) : running ? (
          <Badge tone="violet" mono dot="pulse" size="xs">generating</Badge>
        ) : null
      }
      bodyClassName="p-3 sm:p-4"
    >
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="animate-fade-in">
        {activeTab === "matrix" && <QaMatrixTab cases={cases} runTitle={currentRun?.title} />}
        {activeTab === "playwright" && (
          <PlaywrightTab suite={suite} totalCases={cases.length} caseIds={cases.map((c) => c.id)} runTitle={currentRun?.title} />
        )}
        {activeTab === "telemetry" && (
          <TelemetryDrawer steps={telemetry} traceId={currentRun?.sentryTraceId} running={running} runStartedAt={runStartedAt} />
        )}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </Panel>
  );
}
