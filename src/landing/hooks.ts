import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** Live `matchMedia` result. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True while the referenced element intersects the viewport. */
export function useInView<T extends Element>(ref: RefObject<T | null>, options?: { threshold?: number; rootMargin?: string; once?: boolean }): boolean {
  const [inView, setInView] = useState(false);
  const threshold = options?.threshold ?? 0;
  const rootMargin = options?.rootMargin ?? "0px";
  const once = options?.once ?? false;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin, once]);
  return inView;
}

/** Ref + flag for one-shot scroll reveals: pair with the `.reveal` / `.is-visible` classes. */
export function useReveal<T extends Element>(): { ref: RefObject<T | null>; visible: boolean } {
  const ref = useRef<T>(null);
  const visible = useInView(ref, { threshold: 0.15, rootMargin: "0px 0px -8% 0px", once: true });
  return { ref, visible };
}

const DISPLAY_FONT_HREF = "https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos";

/**
 * Loads the BubbledotICG-FinePos display face for the landing page. The link is added here rather
 * than in index.html so the studio itself never requests anything from a third-party host; the
 * bundled Geist Pixel Circle face covers the title until (or unless) the stylesheet arrives.
 */
export function useDisplayFont(): void {
  useEffect(() => {
    if (document.querySelector(`link[href="${DISPLAY_FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = DISPLAY_FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

/** Id of the section currently crossing the middle of the viewport, for nav highlighting. */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [key]);
  return active;
}
