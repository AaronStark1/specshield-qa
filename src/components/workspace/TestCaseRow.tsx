import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import type { TestCase } from "@shared/types.js";
import { categoryTone, priorityTone } from "../../lib/runs.ts";
import { Badge } from "../ui/Badge.tsx";

/** Columns rendered by the summary row — the table header in QaMatrixTab must match. */
export const TEST_CASE_ROW_COLUMNS = 6;

export interface TestCaseRowProps {
  tc: TestCase;
  /** Category badge. Rendered from `tc.category` when omitted. */
  badge?: ReactNode;
  /** Controlled open state; pair with `onToggle`. Omit to let the row manage its own state. */
  open?: boolean;
  onToggle?: () => void;
  /** Column count of the parent table (for the expanded detail row). */
  colSpan?: number;
}

const DETAIL_FIELDS: { key: "given" | "when" | "then" | "expectedResult"; label: string; tone: string }[] = [
  { key: "given", label: "Given", tone: "text-emerald-300" },
  { key: "when", label: "When", tone: "text-amber-300" },
  { key: "then", label: "Then", tone: "text-cyan-300" },
  { key: "expectedResult", label: "Expected", tone: "text-fg-muted" },
];

export function TestCaseRow({ tc, badge, open, onToggle, colSpan = TEST_CASE_ROW_COLUMNS }: TestCaseRowProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const detailId = useId();

  const toggle = () => {
    if (!controlled) setInternalOpen((v) => !v);
    onToggle?.();
  };

  const onClick = () => {
    // Don't toggle when the user is selecting text inside the row (e.g. copying a title).
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.type === "Range" && sel.toString().length > 0) return;
    toggle();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={isOpen ? detailId : undefined}
        aria-label={`${tc.id}: ${tc.title}`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={clsx(
          "group/row cursor-pointer border-t border-edge-faint transition-colors duration-100",
          "focus-visible:bg-white/[0.04] focus-visible:outline-none",
          isOpen ? "bg-emerald-500/[0.05]" : "hover:bg-white/[0.025]"
        )}
      >
        <td
          className={clsx(
            "whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-emerald-300",
            isOpen
              ? "shadow-[inset_2px_0_0_0_#10b981]"
              : "group-focus-visible/row:shadow-[inset_2px_0_0_0_rgba(16,185,129,0.55)]"
          )}
        >
          {tc.id}
        </td>
        <td className="px-3 py-1.5">{badge ?? <Badge tone={categoryTone(tc.category)}>{tc.category}</Badge>}</td>
        <td className="px-3 py-1.5">
          <Badge tone={priorityTone(tc.priority)} mono>
            {tc.priority}
          </Badge>
        </td>
        <td className="px-3 py-1.5 font-medium text-fg">{tc.title}</td>
        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-fg-dim">{tc.featureId}</td>
        <td className="w-8 px-2 py-1.5 text-fg-dim">
          <ChevronRight
            size={14}
            aria-hidden
            className={clsx("transition-transform duration-150", isOpen && "rotate-90 text-emerald-300")}
          />
        </td>
      </tr>
      {isOpen && (
        <tr id={detailId} className="bg-emerald-500/[0.03]">
          <td colSpan={colSpan} className="px-3 pb-3 pt-1 align-top shadow-[inset_2px_0_0_0_#10b981]">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12px] leading-relaxed">
              {DETAIL_FIELDS.map((f) => (
                <div key={f.key} className="contents">
                  <dt className={clsx("select-none pt-[3px] font-mono text-2xs uppercase tracking-wider", f.tone)}>{f.label}</dt>
                  <dd className={clsx("min-w-0 whitespace-pre-wrap break-words", f.key === "expectedResult" ? "text-fg-muted" : "text-fg")}>
                    {tc[f.key]}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {tc.tags.map((tag) => (
                <Badge key={tag} tone="gray" size="xs" mono>
                  {tag}
                </Badge>
              ))}
              <span className="ml-auto font-mono text-2xs uppercase tracking-wider text-fg-dim">
                feature <span className="text-fg-muted">{tc.featureId}</span>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
