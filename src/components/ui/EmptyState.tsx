import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  /** One or more actions (buttons) rendered under the hint. */
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ title, hint, icon, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-panel border border-dashed border-edge-strong bg-surface-1/60 text-center",
        compact ? "px-4 py-5" : "px-6 py-10",
        className
      )}
    >
      {icon && (
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-surface-2 text-fg-muted">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {hint && <p className="mt-1 max-w-md text-xs leading-relaxed text-fg-muted">{hint}</p>}
      {action && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
