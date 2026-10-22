import { clsx } from "clsx";
import type { ElementType, ReactNode } from "react";

export interface PanelProps {
  title?: ReactNode;
  /** Small monospace eyebrow rendered after the title (e.g. "3 agents", "est."). */
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Right-aligned header controls. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Removes body padding (e.g. for tables / code viewers that manage their own). */
  flush?: boolean;
  as?: ElementType;
  id?: string;
}

/** Standard surface: one border, one radius, consistent header. Avoid nesting Panels. */
export function Panel({ title, subtitle, icon, actions, children, className, bodyClassName, flush, as: Comp = "section", id }: PanelProps) {
  const hasHeader = title || actions || icon;
  return (
    <Comp id={id} className={clsx("panel min-w-0", className)}>
      {hasHeader && (
        <header className="flex min-h-[42px] flex-wrap items-center gap-2 border-b border-edge px-4 py-2">
          {icon && <span className="flex shrink-0 items-center text-fg-muted">{icon}</span>}
          {title && <h2 className="text-13 font-semibold tracking-tight text-fg">{title}</h2>}
          {subtitle && <span className="font-mono text-2xs uppercase tracking-wider text-fg-dim">{subtitle}</span>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={clsx(!flush && "p-4", bodyClassName)}>{children}</div>
    </Comp>
  );
}
