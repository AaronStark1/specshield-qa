import type { ReactNode } from "react";
import { clsx } from "clsx";

export interface WindowProps {
  /** File or document name shown in the title bar. */
  title?: ReactNode;
  /** Replaces the title with custom bar content (for example a URL field). */
  bar?: ReactNode;
  /** Right-hand status badge; pass null to hide it. */
  badge?: ReactNode;
  badgeTone?: "offline" | "recording";
  children: ReactNode;
  className?: string;
}

/** Mac-style window chrome: traffic lights, a title or URL, and a status badge. */
export function Window({ title, bar, badge = "offline", badgeTone = "offline", children, className }: WindowProps) {
  return (
    <div className={clsx("window min-w-0", className)}>
      <div className="window-bar">
        <span className="window-lights" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        {bar ?? <span className="window-title">{title}</span>}
        {badge !== null && <span className={clsx("window-badge", badgeTone === "recording" && "is-recording")}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}
