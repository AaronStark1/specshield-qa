import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import "@fortawesome/fontawesome-free/css/brands.min.css";
import "../landing/landing.css";
import { Hero } from "../landing/Hero.tsx";
import { LandingFooter } from "../landing/LandingFooter.tsx";
import { LandingHeader } from "../landing/LandingHeader.tsx";
import { MetricsSection } from "../landing/MetricsSection.tsx";
import { ProblemSection } from "../landing/ProblemSection.tsx";
import { ShowcaseSection } from "../landing/ShowcaseSection.tsx";
import { WorkflowSection } from "../landing/WorkflowSection.tsx";
import { useDisplayFont, useInView } from "../landing/hooks.ts";
import { Link } from "../lib/router.tsx";
import { DEFAULT_SAMPLE_ID } from "../lib/samples.ts";

const PAGE_TITLE = "SpecShield QA — Built for NDA specs";

export default function Landing() {
  useDisplayFont();
  const heroCtaRef = useRef<HTMLAnchorElement>(null);
  const heroCtaVisible = useInView(heroCtaRef);

  useEffect(() => {
    document.title = PAGE_TITLE;
  }, []);

  return (
    <div className="landing min-h-screen">
      <LandingHeader />
      <main>
        <Hero ctaRef={heroCtaRef} />
        <ProblemSection />
        <WorkflowSection />
        <ShowcaseSection />
        <MetricsSection />
      </main>
      <LandingFooter />

      {/* Sticky mobile call to action: appears once the hero button has scrolled away. */}
      <div
        className={clsx(
          "fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-black/85 p-3 backdrop-blur-xl transition-transform duration-300 md:hidden",
          heroCtaVisible ? "translate-y-full" : "translate-y-0",
        )}
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        aria-hidden={heroCtaVisible}
      >
        <Link
          to={`/studio?sample=${DEFAULT_SAMPLE_ID}`}
          tabIndex={heroCtaVisible ? -1 : 0}
          className="cta-glow flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-[15px] font-semibold text-emerald-950"
        >
          Try the sample spec
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
