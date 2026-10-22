import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface TooltipProps {
  content: ReactNode;
  /** Trigger. Must be focusable (button/link or tabIndex=0) so keyboard users can open it. */
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  wide?: boolean;
  className?: string;
}

/** CSS-only hover/focus tooltip. No portal; keep triggers out of `overflow-hidden` ancestors. */
export function Tooltip({ content, children, side = "bottom", align = "start", wide, className }: TooltipProps) {
  return (
    <span className={clsx("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none invisible absolute z-50 rounded-md border border-edge-strong bg-surface-2/95 px-2.5 py-2 text-left text-[11px] font-normal leading-relaxed text-fg shadow-panel",
          "opacity-0 transition-opacity duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100",
          wide ? "w-72" : "w-56",
          side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
          align === "start" ? "left-0" : "right-0"
        )}
      >
        {content}
      </span>
    </span>
  );
}
