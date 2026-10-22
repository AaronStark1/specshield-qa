import { clsx } from "clsx";
import type { ReactNode } from "react";

export type BadgeTone = "emerald" | "amber" | "violet" | "cyan" | "sky" | "red" | "gray" | "blue";

const tones: Record<BadgeTone, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  gray: "border-white/10 bg-white/[0.04] text-fg-muted",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
};

export interface BadgeProps {
  tone?: BadgeTone | string;
  children: ReactNode;
  className?: string;
  /** Leading status dot; "pulse" animates it (respects reduced motion). */
  dot?: boolean | "pulse";
  /** Accessible label when the visible text is terse (sets aria-label + title). */
  label?: string;
  size?: "xs" | "sm";
  /** Monospace, uppercase, letter-spaced — for machine-ish status chips. */
  mono?: boolean;
  title?: string;
}

export function Badge({ tone = "gray", children, className, dot, label, size = "sm", mono, title }: BadgeProps) {
  const toneCls = tones[(tone as BadgeTone) in tones ? (tone as BadgeTone) : "gray"];
  return (
    <span
      aria-label={label}
      title={title ?? label}
      className={clsx(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md border font-medium leading-4",
        size === "xs" ? "px-1 py-0 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
        mono && "font-mono uppercase tracking-wider",
        toneCls,
        className
      )}
    >
      {dot && <span aria-hidden className={clsx("status-dot", dot === "pulse" && "animate-status-pulse")} />}
      <span className="truncate">{children}</span>
    </span>
  );
}
