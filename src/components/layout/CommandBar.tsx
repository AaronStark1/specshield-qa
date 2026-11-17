import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { ShieldMark } from "../brand/ShieldMark.tsx";

/**
 * The Cyber-Glass command bar shared by the landing page and the studio: a floating obsidian-glass
 * pill with an emerald rim, a beam that circles the rim, and a soft light that follows the cursor.
 */
export function CommandBar({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const bar = event.currentTarget;
    bar.style.setProperty("--mouse-x", `${event.clientX - bar.getBoundingClientRect().left}px`);
  };
  return (
    <div className={clsx("cyber-bar", className)} style={style} onPointerMove={onPointerMove}>
      <svg className="cyber-bar-beam" aria-hidden>
        <rect width="100%" height="100%" rx="25" pathLength={1} />
      </svg>
      <span className="cyber-bar-light" aria-hidden />
      {children}
    </div>
  );
}

/** Brand mark and wordmark; wrap it in the link that suits the page. The wordmark hides where `wordClassName` says so. */
export function CommandBrand({ wordClassName }: { wordClassName?: string }) {
  return (
    <>
      <span className="cyber-brand-mark">
        <ShieldMark size={20} />
      </span>
      <span className={clsx("cyber-brand-word", wordClassName)}>
        SPECSHIELD
        <span className="cyber-brand-tag">QA</span>
      </span>
    </>
  );
}

export interface CommandNavItem<Id extends string = string> {
  id: Id;
  label: string;
  icon?: LucideIcon;
  /** Renders a link to this target; without it the item is a button that calls `onSelect`. */
  href?: string;
  /** Accessible name, when it should say more than the visible label. Must contain the label. */
  ariaLabel?: string;
}

export interface CommandNavProps<Id extends string> {
  label: string;
  items: readonly CommandNavItem<Id>[];
  /** The item under the sliding pill; null hides the pill. */
  activeId: Id | null;
  onSelect?: (id: Id) => void;
  className?: string;
}

/** Navigation items with one illuminated mint pill (and its beacon dot) that slides to the active item. */
export function CommandNav<Id extends string>({ label, items, activeId, onSelect, className }: CommandNavProps<Id>) {
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const target = activeId === null ? null : nav.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`);
      setPill(target && target.offsetWidth > 0 ? { left: target.offsetLeft, width: target.offsetWidth } : null);
    };
    measure();
    // Labels reflow when fonts load, icons hide at a breakpoint, or the nav itself is shown.
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeId]);

  return (
    <nav ref={navRef} aria-label={label} className={clsx("cyber-nav", className)}>
      <span
        aria-hidden
        className={clsx("cyber-nav-pill", pill && "is-visible")}
        style={pill ? { width: pill.width, transform: `translateX(${pill.left}px)` } : undefined}
      />
      {items.map((item) => {
        const active = item.id === activeId;
        const Icon = item.icon;
        const content = (
          <>
            {Icon && <Icon size={14} className="max-sm:hidden" aria-hidden />}
            {item.label}
          </>
        );
        const shared = {
          "data-nav-id": item.id,
          "aria-current": active ? ("true" as const) : undefined,
          "aria-label": item.ariaLabel,
          className: clsx("cyber-nav-item", active && "is-active"),
        };
        return item.href ? (
          <a key={item.id} href={item.href} {...shared}>
            {content}
          </a>
        ) : (
          <button key={item.id} type="button" onClick={() => onSelect?.(item.id)} {...shared}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
