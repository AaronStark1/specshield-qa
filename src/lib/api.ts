import type { HealthResponse, RunRecord } from "@shared/types.js";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}

export async function fetchRuns(): Promise<RunRecord[]> {
  const res = await fetch("/api/runs");
  if (!res.ok) throw new Error(`runs ${res.status}`);
  return res.json() as Promise<RunRecord[]>;
}

export async function fetchRun(id: string): Promise<RunRecord> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`run ${res.status}`);
  return res.json() as Promise<RunRecord>;
}

export async function deleteRun(id: string): Promise<void> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}
