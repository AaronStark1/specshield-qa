import { usePrefersReducedMotion } from "../../hooks/useMediaQuery.ts";

/**
 * A local copy of the ambient loop is served from this origin (public/media) rather than streamed
 * from its CDN, so the studio keeps its promise of making no third-party requests.
 */
const AMBIENT_VIDEO_SRC = "/media/studio-ambient.mp4";

export interface AmbientVideoProps {
  /**
   * "studio": fixed behind the whole page, under the obsidian veil.
   * "hero": the landing page's first screen, screened over the particle field.
   */
  variant?: "studio" | "hero";
}

/** Looping, colour-graded video backdrop. Purely decorative; the footage is omitted when motion is reduced. */
export function AmbientVideo({ variant = "studio" }: AmbientVideoProps) {
  const reducedMotion = usePrefersReducedMotion();
  if (variant === "hero" && reducedMotion) return null;
  return (
    <div className={variant === "hero" ? "hero-ambient" : "studio-ambient"} aria-hidden>
      {!reducedMotion && (
        <video className="bg-video" autoPlay muted loop playsInline preload="metadata">
          <source src={AMBIENT_VIDEO_SRC} type="video/mp4" />
        </video>
      )}
      {variant === "studio" && (
        <>
          <div className="studio-ambient-tint" />
          <div className="studio-ambient-veil" />
        </>
      )}
    </div>
  );
}
