import type { ReactNode } from "react";
import { clsx } from "clsx";
import { FileCode, History, Table2 } from "lucide-react";
import { usePipelineStore, type WorkspaceTab } from "../../state/pipelineStore.ts";
import { Badge } from "../ui/Badge.tsx";
import { Panel } from "../ui/Panel.tsx";
import { Tabs, Tab } from "../ui/Tabs.tsx";
import { QaMatrixTab } from "./QaMatrixTab.tsx";
import { PlaywrightTab } from "./PlaywrightTab.tsx";
import { HistoryTab } from "./HistoryTab.tsx";

const PRIMARY_TABS: { id: WorkspaceTab; label: string; icon: ReactNode }[] = [
  { id: "matrix", label: "QA Matrix", icon: <Table2 size={14} /> },
  { id: "playwright", label: "Playwright Code", icon: <FileCode size={14} /> },
];

/** Output workspace: two primary tabs, with past runs behind a quieter History control. */
export function WorkspaceTabs() {
  const activeTab = usePipelineStore((s) => s.activeTab);
  const setActiveTab = usePipelineStore((s) => s.setActiveTab);
  const currentRun = usePipelineStore((s) => s.currentRun);
  const history = usePipelineStore((s) => s.history);
  const running = usePipelineStore((s) => s.running);

  const cases = currentRun?.testCases ?? [];
  const suite = currentRun?.playwright ?? null;
  const counts: Partial<Record<WorkspaceTab, number>> = {
    matrix: cases.length || undefined,
    playwright: suite ? 1 + suite.pageObjects.length : undefined,
  };
  const historyActive = activeTab === "history";

  return (
    <Panel
      flush
      title={
        <Tabs label="Output">
          {PRIMARY_TABS.map((t) => (
            <Tab
              key={t.id}
              id={`tab-${t.id}`}
              controls={`panel-${t.id}`}
              active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              icon={t.icon}
              count={counts[t.id]}
              className="h-8 px-3 text-13"
            >
              {t.label}
            </Tab>
          ))}
        </Tabs>
      }
      actions={
        <>
          {running && (
            <Badge tone="emerald" dot="pulse">
              Generating
            </Badge>
          )}
          {!running && currentRun && (
            <span className="hidden max-w-[240px] truncate text-xs text-fg-dim md:inline" title={currentRun.title}>
              {currentRun.title}
            </span>
          )}
          <button
            type="button"
            id="tab-history"
            aria-pressed={historyActive}
            onClick={() => setActiveTab(historyActive ? "matrix" : "history")}
            title={historyActive ? "Back to the QA matrix" : "Past runs saved on this machine"}
            className={clsx(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
              historyActive ? "bg-white/[0.07] text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
            )}
          >
            <History size={14} aria-hidden />
            History
            {history.length > 0 && <span className="tabular font-mono text-[10.5px] text-fg-dim">{history.length}</span>}
          </button>
        </>
      }
      bodyClassName="p-3 sm:p-4"
    >
      <div
        role={historyActive ? "region" : "tabpanel"}
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="animate-fade-in"
      >
        {activeTab === "matrix" && <QaMatrixTab cases={cases} runTitle={currentRun?.title} />}
        {activeTab === "playwright" && (
          <PlaywrightTab suite={suite} totalCases={cases.length} caseIds={cases.map((c) => c.id)} runTitle={currentRun?.title} />
        )}
        {historyActive && <HistoryTab />}
      </div>
    </Panel>
  );
}
