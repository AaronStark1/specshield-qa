import { useState, type RefObject } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "../lib/router.tsx";
import { ShieldCanvas } from "./ShieldCanvas.tsx";

export interface HeroProps {
  /** The primary call to action; the page watches it to decide when the sticky mobile CTA appears. */
  ctaRef: RefObject<HTMLAnchorElement | null>;
}

export function Hero({ ctaRef }: HeroProps) {
  const [particleCount, setParticleCount] = useState<number | null>(null);

  return (
    <section id="overview" className="hero" aria-labelledby="hero-title">
      <ShieldCanvas onParticleCount={setParticleCount} />
      <div className="hero-shade" aria-hidden />

      <div className="landing-container relative z-10 flex h-full flex-col justify-end pb-24 pt-24 lg:justify-center lg:pb-16">
        <div className="max-w-[640px]">
          <h1 id="hero-title" className="hero-title font-display">
            Built for
            <br />
            NDA specs.
          </h1>
          <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-[17px]">
            Turn sensitive client PRDs into complete Playwright E2E suites on your own hardware.{" "}
            <span className="text-white">100% offline. Zero cloud calls. $0.00 token cost.</span>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              ref={ctaRef}
              to="/studio"
              className="cta-glow inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-emerald-950 hover:bg-[var(--accent-light)]"
            >
              Start Generating Free
              <ArrowRight size={16} aria-hidden />
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-dim)]">No account · runs on localhost</span>
          </div>
        </div>
      </div>

      <div className="hero-hud pointer-events-none absolute bottom-7 left-10 z-10 hidden lg:block" aria-hidden>
        {particleCount ? `${particleCount.toLocaleString("en-US")} particles · GPU shield` : "Static shield"}
      </div>
      <div className="hero-hud pointer-events-none absolute bottom-7 right-10 z-10 hidden lg:block" aria-hidden>
        {particleCount ? "Move the cursor to disturb the field" : "Motion reduced"}
      </div>

      <a
        href="#problem"
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors duration-200 hover:text-white"
      >
        <span className="inline-block animate-bob">Scroll for logic ↓</span>
      </a>
    </section>
  );
}
