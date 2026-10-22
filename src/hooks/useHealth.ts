import { useSyncExternalStore } from "react";
import { fetchHealth } from "../lib/api.ts";
import type { HealthResponse } from "@shared/types.js";

/**
 * Shared health poller: one request every 15 s no matter how many components subscribe.
 * `health` keeps the last good payload when a probe fails; check `error` for API reachability.
 */
export interface HealthState {
  health: HealthResponse | null;
  error: string | null;
  /** Epoch ms of the last completed probe (success or failure). */
  checkedAt: number | null;
  loading: boolean;
}

const POLL_MS = 15_000;
let state: HealthState = { health: null, error: null, checkedAt: null, loading: false };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
let inflight: Promise<void> | null = null;

function emit(): void {
  for (const l of listeners) l();
}
function patch(p: Partial<HealthState>): void {
  state = { ...state, ...p };
  emit();
}

export function refreshHealth(): Promise<void> {
  if (inflight) return inflight;
  patch({ loading: true });
  inflight = (async () => {
    try {
      const h = await fetchHealth();
      patch({ health: h, error: null, checkedAt: Date.now(), loading: false });
    } catch (e) {
      patch({ error: (e as Error).message || "API unreachable", checkedAt: Date.now(), loading: false });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  subscribers += 1;
  if (subscribers === 1) {
    void refreshHealth();
    timer = setInterval(() => void refreshHealth(), POLL_MS);
  }
  return () => {
    listeners.delete(l);
    subscribers -= 1;
    if (subscribers === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => state;

export function useHealth(): HealthState & { refresh: () => Promise<void> } {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...s, refresh: refreshHealth };
}
