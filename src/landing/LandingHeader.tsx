import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import { ShieldMark } from "../components/brand/ShieldMark.tsx";
import { Link } from "../lib/router.tsx";
import { useActiveSection } from "./hooks.ts";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
  { id: "security", label: "Security" },
] as const;

const SECTION_IDS = SECTIONS.map((s) => s.id);

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(SECTION_IDS);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled ? "border-white/[0.08] bg-black/70 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <div className="landing-container flex h-16 items-center gap-4">
        <a href="#overview" className="flex min-w-0 items-center gap-2.5" aria-label="SpecShield — back to top">
          <ShieldMark size={26} />
          <span className="text-[20px] font-bold leading-none tracking-tight text-white">SPECSHIELD</span>
          <span className="hidden border-l border-white/[0.16] pl-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] sm:inline">
            Local QA Studio
          </span>
        </a>

        <nav
          aria-label="Page sections"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/[0.08] bg-black/50 p-1 backdrop-blur-md lg:flex"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? "true" : undefined}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200",
                active === section.id ? "bg-white/[0.1] text-white" : "text-[var(--text-muted)] hover:text-white",
              )}
            >
              {section.label}
            </a>
          ))}
          <Link
            to="/studio"
            className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors duration-200 hover:text-white"
          >
            Playground
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            className="hidden items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] py-1.5 pl-3 pr-3.5 md:inline-flex"
            title="Specs are processed on this machine; nothing is sent to a cloud model"
          >
            <span className="pulse-dot" aria-hidden />
            <span className="font-display text-[13px] leading-none tracking-wide text-[var(--accent-light)]">00% CLOUD LEAKAGE</span>
          </span>
          <Link
            to="/studio"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition-colors duration-200 hover:bg-emerald-200"
          >
            Launch Studio
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
