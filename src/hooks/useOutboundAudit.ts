import { useEffect, useState } from "react";

export interface OutboundAudit {
  /** Requests this tab made to any host other than the studio's own origin since the studio opened. */
  externalRequests: number;
  /** False when the browser cannot report resource timings. */
  supported: boolean;
}

function isExternal(url: string): boolean {
  try {
    const target = new URL(url, window.location.href);
    if (target.protocol === "data:" || target.protocol === "blob:") return false;
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Counts network requests from this browser tab that leave the studio's origin, starting when the
 * studio mounts. It is the evidence behind the "0 bytes outbound" line on the privacy card: with the
 * count at zero, nothing this page loaded or sent went anywhere but the local studio server.
 */
export function useOutboundAudit(): OutboundAudit {
  const [audit, setAudit] = useState<OutboundAudit>({ externalRequests: 0, supported: typeof PerformanceObserver !== "undefined" });

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const since = performance.now();
    const observer = new PerformanceObserver((list) => {
      const external = list.getEntries().filter((entry) => entry.startTime >= since && isExternal(entry.name)).length;
      if (external > 0) setAudit((current) => ({ ...current, externalRequests: current.externalRequests + external }));
    });
    try {
      observer.observe({ type: "resource", buffered: false });
    } catch {
      setAudit({ externalRequests: 0, supported: false });
      return;
    }
    return () => observer.disconnect();
  }, []);

  return audit;
}
