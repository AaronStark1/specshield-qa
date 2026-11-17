import { useEffect, useRef, useState } from "react";
import { useMediaQuery, usePrefersReducedMotion } from "./hooks.ts";
import type { ShieldField } from "./webgl/ShieldField.ts";
import type { ShapeIndex } from "./webgl/sdf.ts";

/** Position-texture side per breakpoint: 262,144 / 65,536 / 16,384 particles. */
const TEXTURE_SIZE = { desktop: 512, tablet: 256, mobile: 128 } as const;
const MAX_PIXEL_RATIO = 2;
/** Fraction of the viewport height over which the field fades from hero subject to page backdrop. */
const AMBIENT_SCROLL_SPAN = 0.7;

type Tier = keyof typeof TEXTURE_SIZE;

export interface ShieldCanvasProps {
  /** Shape the particle field should form. */
  shape: ShapeIndex;
  /** Reports the live particle count once the simulation is running, and null when it is not. */
  onParticleCount: (count: number | null) => void;
}

/**
 * The WebGL particle field, fixed behind the whole landing page. In the hero it is the subject;
 * once the page scrolls on it dims into a backdrop and keeps morphing with the sections. Renders
 * nothing when the visitor prefers reduced motion or the browser cannot run the simulation; the
 * hero then shows its static SVG shield.
 */
export function ShieldCanvas({ shape, onParticleCount }: ShieldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<ShieldField | null>(null);
  const shapeRef = useRef(shape);
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const isTabletUp = useMediaQuery("(min-width: 768px)");
  const tier: Tier = isDesktop ? "desktop" : isTabletUp ? "tablet" : "mobile";
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const disabled = reducedMotion || unsupported;

  useEffect(() => {
    shapeRef.current = shape;
    fieldRef.current?.setShape(shape);
  }, [shape]);

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let cancelled = false;
    let field: ShieldField | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const applyLayout = () => {
      if (!field) return;
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const wide = window.matchMedia("(min-width: 1024px)").matches;
      field.setLayout({
        width: rect.width,
        height: rect.height,
        pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
        offsetX: wide ? 0.16 : 0,
        offsetY: wide ? 0.02 : 0.17,
        ambientOffsetX: wide ? 0.2 : 0,
        ambientOffsetY: 0,
        ambientOpacity: wide ? 0.34 : 0.2,
      });
    };
    const applyScroll = () => field?.setAmbient(window.scrollY / (window.innerHeight * AMBIENT_SCROLL_SPAN));

    void import("./webgl/ShieldField.ts").then(({ ShieldField: Field }) => {
      if (cancelled) return;
      try {
        field = new Field(canvas, TEXTURE_SIZE[tier], () => setUnsupported(true));
      } catch {
        setUnsupported(true);
        return;
      }
      fieldRef.current = field;
      applyLayout();
      applyScroll();
      field.setShape(shapeRef.current);
      field.start();
      resizeObserver = new ResizeObserver(applyLayout);
      resizeObserver.observe(host);
      window.addEventListener("scroll", applyScroll, { passive: true });
      setReady(true);
      onParticleCount(field.particleCount);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", applyScroll);
      field?.dispose();
      fieldRef.current = null;
      setReady(false);
      onParticleCount(null);
    };
  }, [disabled, tier, onParticleCount]);

  // Cursor and touch movement drive the fluid. Listeners sit on the window because the page
  // content is layered above the canvas.
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const feed = (clientX: number, clientY: number, time: number) => {
      const rect = canvas.getBoundingClientRect();
      fieldRef.current?.pointer(clientX - rect.left, clientY - rect.top, time);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") feed(event.clientX, event.clientY, event.timeStamp);
    };
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) feed(touch.clientX, touch.clientY, event.timeStamp);
    };
    const release = () => fieldRef.current?.releasePointer();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", release, { passive: true });
    window.addEventListener("touchcancel", release, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", release);
    };
  }, [ready]);

  if (disabled) return null;
  return (
    <div ref={hostRef} className="shield-backdrop" aria-hidden>
      <canvas id="bg" ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
