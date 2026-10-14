import type { PipelineEvent } from "@shared/types.js";

type Listener = (ev: PipelineEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export const events = {
  subscribe(runId: string, fn: Listener): () => void {
    let set = listeners.get(runId);
    if (!set) {
      set = new Set();
      listeners.set(runId, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
      if (set && set.size === 0) listeners.delete(runId);
    };
  },
  emit(runId: string, ev: PipelineEvent): void {
    const set = listeners.get(runId);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(ev);
      } catch {
        // ignore listener errors
      }
    }
  },
  clear(runId: string): void {
    listeners.delete(runId);
  },
};
