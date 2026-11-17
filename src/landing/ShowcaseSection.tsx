import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal.tsx";
import { SpotlightGroup } from "./Spotlight.tsx";
import { Window } from "./Window.tsx";
import { useInView, usePrefersReducedMotion } from "./hooks.ts";

interface Clip {
  id: string;
  title: string;
  caption: string;
}

const CLIPS: Clip[] = [
  { id: "spec-parsing", title: "Spec Parsing in Action", caption: "Extracting features and roles" },
  { id: "matrix-filtering", title: "Filtering the Test Matrix", caption: "Sorting by priority and category" },
  { id: "playwright-export", title: "Playwright POM Suite Export", caption: "One-click copy & download" },
  { id: "privacy-audit", title: "Local Privacy Audit", caption: "Verified 0 KB outbound bandwidth" },
];

const STUDIO_URL = "https://localhost:8787/studio";

/** A muted, looping clip inside a browser window shell. Plays only while on screen; a still when motion is reduced. */
function ClipCard({ clip }: { clip: Clip }) {
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(cardRef, { threshold: 0.35 });
  const reducedMotion = usePrefersReducedMotion();
  const poster = `/media/${clip.id}.jpg`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (inView) void video.play().catch(() => undefined);
    else video.pause();
  }, [inView]);

  return (
    <figure ref={cardRef} className="browser-shell spotlight-card">
      <Window
        badge="rec"
        badgeTone="recording"
        bar={
          <span className="window-url" title={STUDIO_URL}>
            <i className="fa-solid fa-lock text-[10px] text-[var(--accent-light)]" aria-hidden />
            <span>{STUDIO_URL}</span>
          </span>
        }
      >
        <div className="browser-viewport">
          {reducedMotion ? (
            <img src={poster} alt={`${clip.title}: ${clip.caption}`} loading="lazy" />
          ) : (
            <video
              ref={videoRef}
              src={`/media/${clip.id}.mp4`}
              poster={poster}
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={`${clip.title}: ${clip.caption}`}
            />
          )}
        </div>
        <figcaption className="border-t border-white/[0.08] px-5 py-4">
          <p className="text-[17px] font-semibold tracking-tight text-white">{clip.title}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--accent-light)]">{clip.caption}</p>
        </figcaption>
      </Window>
    </figure>
  );
}

/** Section 3 — recordings of the real studio. */
export function ShowcaseSection() {
  return (
    <section id="showcase" className="landing-section" aria-labelledby="showcase-title">
      <div className="landing-container">
        <Reveal>
          <p className="section-eyebrow">See it run</p>
          <h2 id="showcase-title" className="section-title mt-4 max-w-[760px]">
            <span className="text-matrix-gradient">The whole studio, on your machine</span>
          </h2>
          <p className="mt-5 max-w-[620px] text-[16px] leading-relaxed text-[var(--text-muted)]">
            Every clip below is the real app running against its offline engine. No staging server, no cloud account.
          </p>
        </Reveal>

        <SpotlightGroup className="mt-12 grid gap-5 md:grid-cols-2">
          {CLIPS.map((clip, i) => (
            <Reveal key={clip.id} delay={(i % 2) * 120} className="min-w-0">
              <ClipCard clip={clip} />
            </Reveal>
          ))}
        </SpotlightGroup>
      </div>
    </section>
  );
}
