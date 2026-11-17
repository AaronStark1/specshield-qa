import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import "@fortawesome/fontawesome-free/css/brands.min.css";
import "../landing/landing.css";
import { AmbientVideo } from "../components/layout/AmbientVideo.tsx";
import { Hero } from "../landing/Hero.tsx";
import { LandingFooter } from "../landing/LandingFooter.tsx";
import { LandingHeader } from "../landing/LandingHeader.tsx";
import { MetricsSection } from "../landing/MetricsSection.tsx";
import { ProblemSection } from "../landing/ProblemSection.tsx";
import { SandboxSection } from "../landing/SandboxSection.tsx";
import { ShieldCanvas } from "../landing/ShieldCanvas.tsx";
import { ShowcaseSection } from "../landing/ShowcaseSection.tsx";
import { WorkflowSection } from "../landing/WorkflowSection.tsx";
import { useActiveSection, useDisplayFont, useInView } from "../landing/hooks.ts";
import type { ShapeIndex } from "../landing/webgl/sdf.ts";
import { Link } from "../lib/router.tsx";
import { DEFAULT_SAMPLE_ID } from "../lib/samples.ts";

const PAGE_TITLE = "SpecShield QA — Built for NDA specs";

/** Shape the particle field takes while each section is on screen; the hero follows the HUD switch. */
const SECTION_SHAPE: Record<string, ShapeIndex> = {
  problem: 0,
  "how-it-works": 1,
  sandbox: 1,
  showcase: 2,
  security: 0,
};
const SECTION_IDS = ["overview", ...Object.keys(SECTION_SHAPE)];

export default function Landing() {
  useDisplayFont();
  const heroCtaRef = useRef<HTMLAnchorElement>(null);
  const heroCtaVisible = useInView(heroCtaRef);
  const activeSection = useActiveSection(SECTION_IDS);
  const [heroShape, setHeroShape] = useState<ShapeIndex>(0);
  const [particleCount, setParticleCount] = useState<number | null>(null);
  const sectionShape = activeSection ? SECTION_SHAPE[activeSection] : undefined;
  const shape = sectionShape ?? heroShape;

  useEffect(() => {
    document.title = PAGE_TITLE;
  }, []);

  return (
    <div className="landing relative min-h-screen">
      <ShieldCanvas shape={shape} onParticleCount={setParticleCount} />
      <AmbientVideo variant="hero" />
      <LandingHeader activeSection={activeSection} />
      <main className="relative z-[1]">
        <Hero ctaRef={heroCtaRef} particleCount={particleCount} shape={shape} onSelectShape={setHeroShape} />
        <div className="landing-ambient-grid">
          <ProblemSection />
          <WorkflowSection />
          <SandboxSection />
          <ShowcaseSection />
          <MetricsSection />
        </div>
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
          className="cta-matrix flex h-12"
        >
          Try the sample spec
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
