import { useEffect, useRef, useState } from "react";
import { StaticShield } from "./StaticShield.tsx";
import { useInView, useMediaQuery, usePrefersReducedMotion } from "./hooks.ts";
import type { ShieldField } from "./webgl/ShieldField.ts";

/** Position-texture side per breakpoint: 262,144 / 65,536 / 16,384 particles. */
const TEXTURE_SIZE = { desktop: 512, tablet: 256, mobile: 128 } as const;
const MAX_PIXEL_RATIO = 2;

type Tier = keyof typeof TEXTURE_SIZE;

export interface ShieldCanvasProps {
  /** Reports the live particle count once the simulation is running (null while static). */
  onParticleCount?: (count: number | null) => void;
}

/**
 * Hero background: the WebGL particle shield, or a static SVG shield when the visitor prefers
 * reduced motion or the browser cannot run the simulation.
 */
export function ShieldCanvas({ onParticleCount }: ShieldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<ShieldField | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const isTabletUp = useMediaQuery("(min-width: 768px)");
  const tier: Tier = isDesktop ? "desktop" : isTabletUp ? "tablet" : "mobile";
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const inView = useInView(hostRef);
  const showStatic = reducedMotion || unsupported;

  useEffect(() => {
    if (showStatic) return;
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
        offsetX: wide ? 0.21 : 0,
        offsetY: wide ? 0.01 : 0.17,
      });
    };

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
      resizeObserver = new ResizeObserver(applyLayout);
      resizeObserver.observe(host);
      setReady(true);
      onParticleCount?.(field.particleCount);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      field?.dispose();
      fieldRef.current = null;
      setReady(false);
      onParticleCount?.(null);
    };
  }, [showStatic, tier, onParticleCount]);

  // Only simulate while the hero is on screen.
  useEffect(() => {
    const field = fieldRef.current;
    if (!ready || !field) return;
    if (inView) field.start();
    else field.stop();
  }, [ready, inView]);

  // Cursor and touch movement drive the fluid. Listeners sit on the window because the hero copy
  // is layered above the canvas.
  useEffect(() => {
    if (!ready || !inView) return;
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
  }, [ready, inView]);

  return (
    <div ref={hostRef} className="absolute inset-0" aria-hidden>
      {showStatic ? (
        <div className="hero-static">
          <StaticShield />
        </div>
      ) : (
        <canvas id="bg" ref={canvasRef} className="hero-canvas" />
      )}
    </div>
  );
}
