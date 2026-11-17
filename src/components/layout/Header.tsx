import type { CSSProperties } from "react";
import { FileText, Loader2, Lock, Play, Table2, Zap } from "lucide-react";
import { useCommandShortcuts } from "../../hooks/useCommandShortcuts.ts";
import { MIN_SPEC_CHARS, usePipeline } from "../../hooks/usePipeline.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { CONTAINER, OUTPUT_PANEL_ID, PRIVACY_PANEL_ID, SPEC_INPUT_ID, SPEC_PANEL_ID } from "../../lib/layout.ts";
import { Link } from "../../lib/router.tsx";
import { CommandBar, CommandBrand, CommandNav, type CommandNavItem } from "./CommandBar.tsx";
import { EngineStatusPill } from "./EngineStatusPill.tsx";

type NavId = "editor" | "matrix" | "playwright" | "security";

const NAV: readonly CommandNavItem<NavId>[] = [
  { id: "editor", label: "Editor", icon: FileText },
  { id: "matrix", label: "QA Matrix", icon: Table2 },
  { id: "playwright", label: "Playwright", icon: Zap },
  { id: "security", label: "Security", icon: Lock, ariaLabel: "Privacy and security" },
];

/** Space the sticky header takes, plus breathing room, when a panel is scrolled into view. */
const SCROLL_OFFSET = 92;
/** The studio bar also carries the engine beacon and the run action, so it is wider than the landing page's. */
const BAR_STYLE = { "--bar-max": "980px" } as CSSProperties;

/** Scrolls a panel under the header unless its top is already comfortably on screen. */
function revealPanel(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  if (top >= 0 && top < window.innerHeight * 0.5) return;
  // "auto" follows the page's scroll-behavior, which is smooth unless the visitor prefers reduced motion.
  window.scrollTo({ top: Math.max(0, window.scrollY + top - SCROLL_OFFSET), behavior: "auto" });
}

/**
 * Studio header: the Cyber-Glass command bar with the brand (back to the landing page), the
 * navigation (Editor, the two output views and the privacy receipt), the engine beacon and the
 * Run Pipeline action. Below the `md` breakpoint the navigation moves to a bar of its own.
 */
export function Header() {
  useCommandShortcuts();
  const { run } = usePipeline();
  const running = usePipelineStore((s) => s.running);
  const specLength = usePipelineStore((s) => s.spec.trim().length);
  const focusArea = usePipelineStore((s) => s.focusArea);
  const activeTab = usePipelineStore((s) => s.activeTab);
  const setActiveTab = usePipelineStore((s) => s.setActiveTab);
  const setFocusArea = usePipelineStore((s) => s.setFocusArea);

  // History has no item here (it lives in the output panel), so nothing is marked while it is open.
  const active: NavId | null = focusArea === "editor" ? "editor" : focusArea === "privacy" ? "security" : activeTab === "history" ? null : activeTab;
  const remaining = Math.max(0, MIN_SPEC_CHARS - specLength);

  const select = (id: NavId) => {
    if (id === "editor") {
      setFocusArea("editor");
      revealPanel(SPEC_PANEL_ID);
      // Put the caret in the spec on pointer devices; on touch that would only raise the keyboard.
      if (window.matchMedia("(pointer: fine)").matches) document.getElementById(SPEC_INPUT_ID)?.focus({ preventScroll: true });
    } else if (id === "security") {
      setFocusArea("privacy");
      revealPanel(PRIVACY_PANEL_ID);
    } else {
      setActiveTab(id);
      revealPanel(OUTPUT_PANEL_ID);
    }
  };

  return (
    <header className="studio-header">
      <div className={`${CONTAINER} flex flex-col gap-2 py-3`}>
        <CommandBar style={BAR_STYLE}>
          <Link to="/" className="cyber-brand" aria-label="SpecShield QA — back to the overview">
            <CommandBrand wordClassName="hidden xl:inline-flex" />
          </Link>
          <CommandNav label="Studio views" items={NAV} activeId={active} onSelect={select} className="mx-auto hidden md:flex" />
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <EngineStatusPill />
            <button
              type="button"
              disabled={running || remaining > 0}
              aria-busy={running || undefined}
              onClick={() => void run()}
              title={
                running
                  ? "Generation is in progress"
                  : remaining > 0
                    ? `Add ${remaining.toLocaleString("en-US")} more character${remaining === 1 ? "" : "s"} to the spec`
                    : "Generate the QA matrix and the Playwright suite"
              }
              className="cta-matrix cta-matrix-compact"
            >
              {running ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden /> : <Play size={12} className="shrink-0 fill-current" aria-hidden />}
              {running ? "Running…" : "Run Pipeline"}
            </button>
          </div>
        </CommandBar>
        <CommandBar className="md:hidden">
          <CommandNav label="Studio views" items={NAV} activeId={active} onSelect={select} className="mx-auto" />
        </CommandBar>
      </div>
    </header>
  );
}
