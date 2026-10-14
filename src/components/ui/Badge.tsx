import { clsx } from "clsx";
import type { ReactNode } from "react";

const tones: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  gray: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof tones | string; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone] ?? tones.gray, className)}>
      {children}
    </span>
  );
}
