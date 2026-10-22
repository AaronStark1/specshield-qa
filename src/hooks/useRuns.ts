import { useCallback, useEffect } from "react";
import { deleteRun, fetchRun, fetchRuns } from "../lib/api.ts";
import { usePipelineStore } from "../state/pipelineStore.ts";

export function useRuns(): {
  reload: () => Promise<void>;
  open: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const reload = useCallback(async () => {
    const st = usePipelineStore.getState();
    st.setHistoryStatus(st.history.length > 0 ? "ready" : "loading");
    try {
      const h = await fetchRuns();
      st.setHistory(h);
      st.setHistoryStatus("ready");
      if (!st.currentRun && h.length > 0) {
        const full = await fetchRun(h[0]!.id).catch(() => h[0]!);
        st.setCurrentRun(full);
        st.setSteps(full.telemetry ?? []);
      }
    } catch (e) {
      st.setHistoryStatus("error", (e as Error).message || "Could not load run history");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = useCallback(async (id: string) => {
    const full = await fetchRun(id);
    const st = usePipelineStore.getState();
    st.setCurrentRun(full);
    st.setSteps(full.telemetry ?? []);
    st.setRunStartedAt(null);
    st.setSpec(full.spec ?? st.spec);
    st.setTitle(full.title ?? "");
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteRun(id);
    const st = usePipelineStore.getState();
    st.setHistory(st.history.filter((r) => r.id !== id));
    if (st.currentRun?.id === id) {
      const next = st.history.find((r) => r.id !== id) ?? null;
      if (next) {
        try {
          const full = await fetchRun(next.id);
          st.setCurrentRun(full);
          st.setSteps(full.telemetry ?? []);
        } catch {
          st.setCurrentRun(null);
        }
      } else {
        st.setCurrentRun(null);
      }
    }
  }, []);

  return { reload, open, remove };
}
