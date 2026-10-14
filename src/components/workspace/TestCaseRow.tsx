import { useState } from "react";
import type { ReactNode } from "react";
import type { TestCase } from "@shared/types.js";
import { Badge } from "../ui/Badge.tsx";

export function TestCaseRow({ tc, badge }: { tc: TestCase; badge: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="cursor-pointer border-t border-[#1f2937] hover:bg-white/[0.02]" onClick={() => setOpen((v) => !v)}>
        <td className="px-3 py-2 font-mono text-[11px] text-emerald-300">{tc.id}</td>
        <td className="px-3 py-2">{badge}</td>
        <td className="px-3 py-2"><Badge tone="gray">{tc.priority}</Badge></td>
        <td className="px-3 py-2 font-medium text-[#e5e7eb]">{tc.title}</td>
        <td className="px-3 py-2 font-mono text-[11px] text-[#9ca3af]">{tc.featureId}</td>
      </tr>
      {open && (
        <tr className="border-t border-[#1f2937] bg-black/20">
          <td colSpan={5} className="px-3 py-2 text-[12px] leading-relaxed">
            <p><strong className="text-emerald-300">Given</strong> {tc.given}</p>
            <p className="mt-1"><strong className="text-amber-300">When</strong> {tc.when}</p>
            <p className="mt-1"><strong className="text-sky-300">Then</strong> {tc.then}</p>
            <p className="mt-1 text-[#9ca3af]"><strong>Expected:</strong> {tc.expectedResult}</p>
            <p className="mt-1 font-mono text-[11px] text-[#6b7280]">{tc.tags.join(" · ")}</p>
          </td>
        </tr>
      )}
    </>
  );
}
