import { ShieldMark } from "../brand/ShieldMark.tsx";
import { CONTAINER } from "../../lib/layout.ts";
import { DOCS_URL, LICENSE_URL, REPO_URL } from "../../lib/links.ts";

const LINKS = [
  { label: "Documentation", href: DOCS_URL },
  { label: "GitHub", href: REPO_URL },
  { label: "MIT License", href: LICENSE_URL },
] as const;

export function Footer() {
  return (
    <footer className="relative z-[1] mt-auto border-t border-edge">
      <div className={`${CONTAINER} flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-3 text-13 sm:justify-between`}>
        <span className="inline-flex items-center gap-2 text-fg-muted">
          <ShieldMark size={16} />
          SpecShield QA · v{__APP_VERSION__}
        </span>
        <nav aria-label="Project links" className="flex flex-wrap items-center justify-center gap-x-2 text-fg-dim">
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
