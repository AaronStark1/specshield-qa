import { useEffect, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { GitCompare, History, RefreshCw, Trash2 } from "lucide-react";
import type { RunRecord } from "@shared/types.js";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { useRuns } from "../../hooks/useRuns.ts";
import { formatDateTime, formatDuration, formatNumber, formatRelative } from "../../lib/format.ts";
import { modeTone, outcomeTone, runDurationMs, runOutcome } from "../../lib/runs.ts";
import { Badge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { RunDiff } from "./RunDiff.tsx";

type Busy = { id: string; kind: "open" | "delete" } | null;
type RowError = { id: string; message: string } | null;

function errorMessage(e: unknown, fallback: string): string {
  return (e instanceof Error && e.message) || fallback;
}

function Sep() {
  return (
    <span aria-hidden className="text-fg-faint">
      ·
    </span>
  );
}

interface RowProps {
  run: RunRecord;
  isCurrent: boolean;
  hasCurrent: boolean;
  comparing: boolean;
  confirming: boolean;
  busy: Busy;
  error: RowError;
  onOpen: () => void;
  onToggleCompare: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onKeep: () => void;
  children?: ReactNode;
}

function HistoryRow({
  run,
  isCurrent,
  hasCurrent,
  comparing,
  confirming,
  busy,
  error,
  onOpen,
  onToggleCompare,
  onAskDelete,
  onConfirmDelete,
  onKeep,
  children,
}: RowProps) {
  const cases = run.testCases?.length ?? 0;
  const duration = runDurationMs({ telemetry: run.telemetry ?? [] });
  const outcome = runOutcome(run.telemetry ?? []);
  const opening = busy?.id === run.id && busy.kind === "open";
  const deleting = busy?.id === run.id && busy.kind === "delete";
  const compareDisabled = !hasCurrent || isCurrent;
  const compareTitle = !hasCurrent ? "Open a run first to compare against it" : isCurrent ? "This is the current run" : "Compare with the current run";

  return (
    <li
      aria-current={isCurrent ? "true" : undefined}
      className={clsx(
        "rounded-panel border px-3 py-2 transition-colors duration-150",
        isCurrent
          ? "border-emerald-500/35 bg-emerald-500/[0.04]"
          : comparing
            ? "border-cyan-500/35 bg-cyan-500/[0.03]"
            : "border-edge bg-surface-2/40 hover:border-edge-strong"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={onOpen}
          disabled={opening}
          title={isCurrent ? "Reload this run" : "Open this run"}
          className="min-w-0 flex-1 basis-52 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-13 font-medium text-fg">{run.title || "Untitled run"}</span>
            {isCurrent && (
              <Badge tone="emerald" mono size="xs" label="Current run">
                current
              </Badge>
            )}
          </span>
          <span className="tabular mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-2xs text-fg-dim">
            <span title={formatDateTime(run.createdAt)}>{formatRelative(run.createdAt)}</span>
            <Sep />
            <span>
              {cases} {cases === 1 ? "case" : "cases"}
            </span>
            <Sep />
            <span title="Sum of recorded step durations">{duration == null ? "—" : formatDuration(duration)}</span>
            <Sep />
            <span className="truncate" title="Model">
              {run.model || "—"}
            </span>
            <Sep />
            <span title="Spec sha256 (first 12) · spec length">
              {run.specHash || "—"} · {formatNumber(run.specChars)} chars
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1">
          <Badge tone={modeTone(run.mode)} mono size="xs" label={`Execution mode: ${run.mode}`}>
            {run.mode}
          </Badge>
          {outcome !== run.mode && (
            <Badge tone={outcomeTone(outcome)} mono size="xs" label={`Outcome: ${outcome}`}>
              {outcome}
            </Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1" role="group" aria-label={`Actions for ${run.title || "run"}`}>
          <Button variant="ghost" size="sm" onClick={onOpen} loading={opening} aria-label={`Open ${run.title || "run"}`}>
            Open
          </Button>
          {/* Disabled buttons drop pointer events, so the explanatory title sits on a wrapper. */}
          <span title={compareTitle} className="inline-flex">
            <Button
              variant="secondary"
              size="sm"
              icon={<GitCompare size={13} aria-hidden />}
              onClick={onToggleCompare}
              disabled={compareDisabled}
              aria-pressed={comparing}
              aria-label={comparing ? `Close comparison for ${run.title || "run"}` : `Compare ${run.title || "run"} with the current run`}
            >
              Compare
            </Button>
          </span>
          {confirming ? (
            <span role="group" aria-label="Confirm delete" className="inline-flex items-center gap-1 animate-fade-in">
              <Button variant="danger" size="sm" onClick={onConfirmDelete} loading={deleting} icon={<Trash2 size={13} aria-hidden />}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={onKeep} disabled={deleting}>
                Keep
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={13} aria-hidden />}
              onClick={onAskDelete}
              aria-label={`Delete ${run.title || "run"}`}
              title="Delete this run from data/runs.json"
              className="px-1.5 hover:text-red-300"
            />
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 font-mono text-2xs text-red-300">
          {error.message}
        </p>
      )}
      {children && <div className="mt-2">{children}</div>}
    </li>
  );
}

export function HistoryTab() {
  const history = usePipelineStore((s) => s.history);
  const historyStatus = usePipelineStore((s) => s.historyStatus);
  const historyError = usePipelineStore((s) => s.historyError);
  const currentRun = usePipelineStore((s) => s.currentRun);
  const escapeTick = usePipelineStore((s) => s.escapeTick);
  const { open, remove, reload } = useRuns();

  const [diffId, setDiffId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [rowError, setRowError] = useState<RowError>(null);

  // Global Esc: close the comparison and cancel any pending delete confirm.
  useEffect(() => {
    setDiffId(null);
    setConfirmId(null);
  }, [escapeTick]);

  // The row being compared became the current run (or vanished): drop the stale selection.
  useEffect(() => {
    if (diffId && (currentRun?.id === diffId || !history.some((r) => r.id === diffId))) setDiffId(null);
  }, [diffId, currentRun?.id, history]);

  const handleOpen = async (id: string) => {
    setBusy({ id, kind: "open" });
    setRowError(null);
    try {
      await open(id);
    } catch (e) {
      setRowError({ id, message: errorMessage(e, "Could not open this run") });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy({ id, kind: "delete" });
    setRowError(null);
    try {
      await remove(id);
      if (diffId === id) setDiffId(null);
    } catch (e) {
      setRowError({ id, message: errorMessage(e, "Could not delete this run") });
    } finally {
      setConfirmId(null);
      setBusy(null);
    }
  };

  const loading = historyStatus === "loading";
  const count = history.length;

  let body: ReactNode;
  if (loading && count === 0) {
    body = (
      <ol aria-busy="true" aria-label="Loading run history" className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-14 rounded-panel border border-edge bg-gradient-to-r from-surface-1 via-surface-3 to-surface-1 bg-[length:200%_100%] animate-shimmer"
          />
        ))}
      </ol>
    );
  } else if (historyStatus === "error" && count === 0) {
    body = (
      <EmptyState
        icon={<History size={16} aria-hidden />}
        title="Could not load run history"
        hint={historyError || "The API did not answer the /api/runs request."}
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} aria-hidden />} onClick={() => void reload()}>
            Retry
          </Button>
        }
      />
    );
  } else if (count === 0) {
    body = (
      <EmptyState
        icon={<History size={16} aria-hidden />}
        title="No local runs yet"
        hint="Every pipeline run is written to data/runs.json on the API host. Nothing is uploaded; refresh after your first run."
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} aria-hidden />} onClick={() => void reload()}>
            Refresh
          </Button>
        }
      />
    );
  } else {
    body = (
      <ol className="space-y-2" aria-label="Run history, newest first">
        {history.map((r) => {
          const isCurrent = currentRun?.id === r.id;
          const comparing = diffId === r.id && !!currentRun && !isCurrent;
          return (
            <HistoryRow
              key={r.id}
              run={r}
              isCurrent={isCurrent}
              hasCurrent={!!currentRun}
              comparing={comparing}
              confirming={confirmId === r.id}
              busy={busy}
              error={rowError?.id === r.id ? rowError : null}
              onOpen={() => void handleOpen(r.id)}
              onToggleCompare={() => {
                setDiffId((cur) => (cur === r.id ? null : r.id));
                setConfirmId(null);
              }}
              onAskDelete={() => setConfirmId(r.id)}
              onConfirmDelete={() => void handleDelete(r.id)}
              onKeep={() => setConfirmId(null)}
            >
              {comparing && currentRun && <RunDiff a={currentRun} b={r} onClose={() => setDiffId(null)} />}
            </HistoryRow>
          );
        })}
      </ol>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <History size={13} className="shrink-0 text-fg-dim" aria-hidden />
        <span className="font-mono text-2xs uppercase tracking-wider text-fg-dim">
          <span className="tabular text-fg-muted">{count}</span> {count === 1 ? "run" : "runs"} · data/runs.json (API host)
        </span>
        {historyStatus === "error" && count > 0 && (
          <span role="alert" className="font-mono text-2xs text-red-300" title={historyError ?? undefined}>
            refresh failed — showing last loaded list
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={13} aria-hidden />}
          loading={loading}
          onClick={() => void reload()}
          className="ml-auto"
          aria-label="Refresh run history"
        >
          Refresh
        </Button>
      </div>
      {body}
    </div>
  );
}
