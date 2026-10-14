import { useState } from "react";
import { GitCompare, Trash2 } from "lucide-react";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { useRuns } from "../../hooks/useRuns.ts";
import { formatDate, formatDuration } from "../../lib/format.ts";
import { Badge } from "../ui/Badge.tsx";
import { GhostButton } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { RunDiff } from "./RunDiff.tsx";

export function HistoryTab() {
  const { history, currentRun } = usePipelineStore();
  const { open, remove, reload } = useRuns();
  const [diffId, setDiffId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div>
        <EmptyState title="No local runs yet" hint="Runs persist to data/runs.json with zero setup." />
        <div className="mt-2"><GhostButton onClick={() => void reload()}>Refresh</GhostButton></div>
      </div>
    );
  }

  const diffRun = history.find((r) => r.id === diffId) ?? null;

  return (
    <div className="space-y-2">
      {history.map((r) => (
        <div key={r.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${currentRun?.id === r.id ? "border-emerald-500/50 bg-emerald-500/5" : "border-[#1f2937] bg-[#0b0f17]"}`}>
          <button onClick={() => void open(r.id)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-semibold">{r.title}</div>
            <div className="mt-0.5 font-mono text-[11px] text-[#9ca3af]">
              {formatDate(r.createdAt)} · {r.testCases?.length ?? 0} cases · {formatDuration(r.telemetry?.reduce((s, t) => s + (t.durationMs ?? 0), 0) ?? 0)}
            </div>
          </button>
          <Badge tone={r.mode === "gemma" ? "violet" : r.mode === "mixed" ? "sky" : "amber"}>{r.mode}</Badge>
          <GhostButton onClick={() => setDiffId(diffId === r.id ? null : r.id)} title="Compare with current">
            <GitCompare size={14} /> Compare
          </GhostButton>
          {confirm === r.id ? (
            <>
              <GhostButton onClick={() => void remove(r.id).then(() => setConfirm(null))}>Confirm</GhostButton>
              <GhostButton onClick={() => setConfirm(null)}>Cancel</GhostButton>
            </>
          ) : (
            <GhostButton onClick={() => setConfirm(r.id)} title="Delete"><Trash2 size={14} /></GhostButton>
          )}
        </div>
      ))}
      {diffRun && currentRun && diffRun.id !== currentRun.id && (
        <RunDiff a={currentRun} b={diffRun} onClose={() => setDiffId(null)} />
      )}
    </div>
  );
}
