import { useSyncExternalStore } from "react";

/**
 * A local copy of the ambient loop is served from this origin (public/media) rather than streamed
 * from its CDN, so the studio keeps its promise of making no third-party requests.
 */
const AMBIENT_VIDEO_SRC = "/media/studio-ambient.mp4";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Fixed, colour-graded video backdrop for the studio. Purely decorative; omitted when motion is reduced. */
export function AmbientVideo() {
  const reducedMotion = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  return (
    <div className="studio-ambient" aria-hidden>
      {!reducedMotion && (
        <video className="bg-video" autoPlay muted loop playsInline preload="metadata">
          <source src={AMBIENT_VIDEO_SRC} type="video/mp4" />
        </video>
      )}
      <div className="studio-ambient-tint" />
      <div className="studio-ambient-veil" />
    </div>
  );
}
