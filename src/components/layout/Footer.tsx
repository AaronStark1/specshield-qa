import { ShieldMark } from "../brand/ShieldMark.tsx";
import { CONTAINER } from "../../lib/layout.ts";
import { DOCS_URL, LICENSE_URL, REPO_URL } from "../../lib/links.ts";
import { EngineStatusPill } from "./EngineStatusPill.tsx";

const LINKS = [
  { label: "Documentation", href: DOCS_URL },
  { label: "GitHub", href: REPO_URL },
  { label: "MIT License", href: LICENSE_URL },
] as const;

export function Footer() {
  return (
    <footer className="mt-auto border-t border-edge">
      <div className={`${CONTAINER} grid items-center gap-x-4 gap-y-3 py-3 text-13 md:grid-cols-[1fr_auto_1fr]`}>
        <span className="inline-flex items-center justify-center gap-2 text-fg-muted md:justify-start">
          <ShieldMark size={16} />
          SpecShield QA · v{__APP_VERSION__}
        </span>
        <div className="flex justify-center">
          <EngineStatusPill />
        </div>
        <nav aria-label="Project links" className="flex flex-wrap items-center justify-center gap-x-2 text-fg-dim md:justify-end">
          {LINKS.map((link, i) => (
            <span key={link.label} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden>·</span>}
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-fg-muted transition-colors hover:text-fg">
                {link.label}
              </a>
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}
