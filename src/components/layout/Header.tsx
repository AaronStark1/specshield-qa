import { ArrowLeft } from "lucide-react";
import { ShieldMark } from "../brand/ShieldMark.tsx";
import { useCommandShortcuts } from "../../hooks/useCommandShortcuts.ts";
import { usePipelineStore } from "../../state/pipelineStore.ts";
import { DOCS_URL } from "../../lib/links.ts";
import { CONTAINER } from "../../lib/layout.ts";
import { Link } from "../../lib/router.tsx";
import { Badge } from "../ui/Badge.tsx";
import { EngineStatusPill } from "./EngineStatusPill.tsx";

/** Studio header: brand, the engine indicator, and a way back to the overview. */
export function Header() {
  useCommandShortcuts();
  const running = usePipelineStore((s) => s.running);

  return (
    <header className="glass sticky top-0 z-40 border-b border-edge">
      <div className={`${CONTAINER} flex h-14 items-center gap-4`}>
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-md" aria-label="SpecShield QA — overview">
          <ShieldMark size={24} />
          <span className="text-[17px] font-bold leading-none tracking-tight text-white">SpecShield QA</span>
        </Link>
        <EngineStatusPill className="min-w-0" />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {running && (
            <Badge tone="emerald" dot="pulse" label="A run is in progress">
              Generating
            </Badge>
          )}
          <Link
            to="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-13 font-medium text-fg-muted transition-colors duration-150 hover:bg-white/[0.04] hover:text-fg"
          >
            <ArrowLeft size={14} aria-hidden />
            Overview
          </Link>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-8 items-center rounded-md px-2.5 text-13 font-medium text-fg-muted transition-colors duration-150 hover:bg-white/[0.04] hover:text-fg sm:inline-flex"
          >
            Docs
          </a>
        </div>
      </div>
    </header>
  );
}
