import { ArrowRight } from "lucide-react";
import { ShieldMark } from "../components/brand/ShieldMark.tsx";
import { Link } from "../lib/router.tsx";
import { DOCS_URL, LICENSE_URL, REPO_URL } from "../lib/links.ts";
import { Reveal } from "./Reveal.tsx";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-black">
      <div className="landing-container py-24 text-center md:py-28">
        <Reveal>
          <ShieldMark size={44} className="mx-auto" />
          <h2 className="font-display mx-auto mt-6 max-w-[720px] text-[clamp(26px,4.4vw,48px)] uppercase leading-[1.08] text-white">
            Keep the spec. Ship the suite.
          </h2>
          <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-relaxed text-[var(--text-muted)]">
            Open the studio, load the Invoice Tracker demo and watch a full Playwright suite appear without a single cloud call.
          </p>
          <Link
            to="/studio"
            className="cta-glow mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-emerald-950 hover:bg-[var(--accent-light)]"
          >
            Start Generating Free
            <ArrowRight size={16} aria-hidden />
          </Link>
        </Reveal>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="landing-container flex flex-col items-center gap-4 py-7 text-[13px] text-[var(--text-dim)] md:flex-row md:justify-between">
          <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
            <ShieldMark size={18} /> SpecShield QA · v{__APP_VERSION__}
          </span>
          <nav aria-label="Project links" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
              Documentation
            </a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
              <i className="fa-brands fa-github" aria-hidden /> GitHub
            </a>
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
              MIT License
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
