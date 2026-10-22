import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Tactile dark keycap. Accepts a string ("⌘↵") or multiple keys ("Ctrl", "Enter"). */
export function Kbd({ children, className, size = "sm" }: { children: ReactNode; className?: string; size?: "xs" | "sm" }) {
  return (
    <kbd
      className={clsx(
        "inline-flex min-w-[1.5em] select-none items-center justify-center rounded border border-white/15 border-b-white/5",
        "bg-gradient-to-b from-white/[0.09] to-black/40 font-mono font-medium text-fg-muted",
        "shadow-[0_1px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]",
        size === "xs" ? "px-1 text-[10px] leading-[16px]" : "px-1.5 text-[10.5px] leading-[18px]",
        className
      )}
    >
      {children}
    </kbd>
  );
}
