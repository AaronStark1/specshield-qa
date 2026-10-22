import { useEffect } from "react";
import { canRunSpec, usePipeline } from "./usePipeline.ts";
import { usePipelineStore } from "../state/pipelineStore.ts";

export type ModifierLabel = "⌘" | "Ctrl";

let cachedModifier: ModifierLabel | null = null;

/** "⌘" on Apple platforms, "Ctrl" elsewhere. Detected once from `navigator` and cached. */
export function getModifierLabel(): ModifierLabel {
  if (cachedModifier) return cachedModifier;
  if (typeof navigator === "undefined") return "Ctrl";
  const probe = `${navigator.platform} ${navigator.userAgent}`;
  cachedModifier = /mac|iphone|ipad|ipod/i.test(probe) ? "⌘" : "Ctrl";
  return cachedModifier;
}

function isEditable(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

/**
 * Global keyboard commands. Mount exactly once (the Header does).
 *
 *  - ⌘/Ctrl+Enter → start the pipeline. Works while the spec textarea has focus. Ignored on key
 *    repeat, during IME composition, while a run is in progress, or when the spec is too short.
 *  - Esc → if a form control / contenteditable has focus, blur it and stop. Otherwise bump
 *    `escapeTick` so transient UI (diff panels, confirm prompts, expanded rows) can dismiss itself.
 *
 * Esc never cancels a run and never clears the spec.
 */
export function useCommandShortcuts(): void {
  const { run } = usePipeline();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (e.repeat || e.isComposing) return;
        e.preventDefault();
        const { running, spec } = usePipelineStore.getState();
        if (running || !canRunSpec(spec)) return;
        void run();
        return;
      }

      if (e.key === "Escape") {
        if (e.isComposing) return;
        const active = document.activeElement;
        if (isEditable(active)) {
          active.blur();
          return;
        }
        usePipelineStore.getState().bumpEscape();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [run]);
}
