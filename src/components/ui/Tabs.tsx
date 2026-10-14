import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Tabs({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex flex-wrap gap-2", className)}>{children}</div>;
}

export function Tab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
        active ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-[#1f2937] bg-[#111827] text-[#9ca3af] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
