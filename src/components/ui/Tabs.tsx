import { clsx } from "clsx";
import type { KeyboardEvent, ReactNode } from "react";

/**
 * Segmented-control tabs. Arrow keys / Home / End move between tabs (automatic activation).
 * Keep `active` + `onClick` on each <Tab>; the active tab is the only one in the tab order.
 */
export function Tabs({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
    if (tabs.length === 0) return;
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else next = tabs.length - 1;
    e.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={clsx("inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-edge bg-black/30 p-0.5", className)}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  /** Small monospace count rendered after the label. */
  count?: number | string;
  id?: string;
  /** id of the tabpanel this tab controls */
  controls?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function Tab({ active, onClick, children, icon, count, id, controls, disabled, className, title }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={clsx(
        "relative inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        active
          ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.5)]"
          : "text-fg-muted hover:bg-white/[0.03] hover:text-fg",
        disabled && "opacity-40",
        className
      )}
    >
      {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-px bg-emerald-400/80" />}
      {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      <span>{children}</span>
      {count !== undefined && (
        <span className={clsx("tabular font-mono text-[10.5px]", active ? "text-emerald-300" : "text-fg-dim")}>{count}</span>
      )}
    </button>
  );
}
