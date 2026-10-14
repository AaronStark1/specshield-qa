import { useEffect, useState } from "react";
import { fetchHealth } from "../lib/api.ts";
import type { HealthResponse } from "@shared/types.js";

export function useHealth(): { health: HealthResponse | null; error: string | null } {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const h = await fetchHealth();
        if (alive) {
          setHealth(h);
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return { health, error };
}
