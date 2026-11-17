import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type Ref } from "react";

/** Minimal history-based router: two pages do not justify a routing dependency. */
const NAVIGATE_EVENT = "specshield:navigate";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

const getPath = (): string => window.location.pathname;

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath, () => "/");
}

/** Client-side navigation. `to` may carry a query string or hash. */
export function navigate(to: string): void {
  const before = window.location.pathname;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
  if (window.location.pathname !== before) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  ref?: Ref<HTMLAnchorElement>;
}

/** Same-origin link that navigates without a page load; modified clicks keep their browser behaviour. */
export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
