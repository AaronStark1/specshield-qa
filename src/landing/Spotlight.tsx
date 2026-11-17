import type { PointerEvent, ReactNode } from "react";
import { clsx } from "clsx";

/**
 * Tracks the cursor for every `.spotlight-card` inside it and exposes the position to CSS as
 * `--mouse-x` / `--mouse-y`, so each card's border lights up nearest the pointer, including the
 * neighbours of the card being hovered.
 */
export function SpotlightGroup({ children, className }: { children: ReactNode; className?: string }) {
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    for (const card of event.currentTarget.querySelectorAll<HTMLElement>(".spotlight-card")) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
    }
  };
  return (
    <div className={clsx("spotlight-group", className)} onPointerMove={onPointerMove}>
      {children}
    </div>
  );
}
