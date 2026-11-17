import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./useMediaQuery.ts";

export interface CountUpOptions {
  from?: number;
  durationMs?: number;
  /** The count starts when this turns true; until then the value rests at `from`. */
  active?: boolean;
  /** Change this to replay the count (for example the id of the run the numbers describe). */
  replayKey?: string | number;
}

/** Eases a number from `from` to `to`. Jumps straight to `to` when motion is reduced. */
export function useCountUp(to: number, { from = 0, durationMs = 1400, active = true, replayKey }: CountUpOptions = {}): number {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!active) {
      setValue(from);
      return;
    }
    if (reducedMotion) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion, from, to, durationMs, replayKey]);

  return value;
}
