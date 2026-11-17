import type { RefObject } from "react";
import { clsx } from "clsx";
import { ArrowRight, Grid3x3, Shield, Zap, type LucideIcon } from "lucide-react";
import { Link } from "../lib/router.tsx";
import { StaticShield } from "./StaticShield.tsx";
import { SHAPES, type ShapeIndex } from "./webgl/sdf.ts";

const SHAPE_ICONS: readonly LucideIcon[] = [Shield, Grid3x3, Zap];

export interface HeroProps {
  /** The primary call to action; the page watches it to decide when the sticky mobile CTA appears. */
  ctaRef: RefObject<HTMLAnchorElement | null>;
  /** Live particle count, or null when the static shield is shown instead of the simulation. */
  particleCount: number | null;
  shape: ShapeIndex;
  onSelectShape: (shape: ShapeIndex) => void;
}

/** HUD switch that morphs the particle field between its three shapes. */
function ShapeSwitcher({ shape, onSelect, className }: { shape: ShapeIndex; onSelect: (shape: ShapeIndex) => void; className?: string }) {
  return (
    <div role="group" aria-label="Particle shape" className={clsx("shape-switcher", className)}>
      {SHAPES.map((item, index) => {
        const Icon = SHAPE_ICONS[index]!;
        const active = shape === index;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            title={item.name}
            onClick={() => onSelect(index as ShapeIndex)}
            className={clsx("shape-switcher-button", active && "is-active")}
          >
            <Icon size={13} aria-hidden />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function Hero({ ctaRef, particleCount, shape, onSelectShape }: HeroProps) {
  const live = particleCount !== null;

  return (
    <section id="overview" className="hero" aria-labelledby="hero-title">
      {!live && (
        <div className="hero-static" aria-hidden>
          <StaticShield />
        </div>
      )}
      <div className="hero-shade" aria-hidden />

      {live && <ShapeSwitcher shape={shape} onSelect={onSelectShape} className="absolute left-1/2 top-[76px] z-20 inline-flex -translate-x-1/2 lg:hidden" />}

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
        {live ? `${particleCount.toLocaleString("en-US")} particles · ${SHAPES[shape].name}` : "Static shield · motion reduced"}
      </div>
      {live && <ShapeSwitcher shape={shape} onSelect={onSelectShape} className="absolute bottom-5 right-10 z-20 hidden lg:inline-flex" />}

      <a
        href="#problem"
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors duration-200 hover:text-white"
      >
        <span className="inline-block animate-bob">Scroll for logic ↓</span>
      </a>
    </section>
  );
}
