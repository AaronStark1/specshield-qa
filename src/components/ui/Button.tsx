import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in the icon slot and disables the button. Pass `icon` so the swap causes no layout shift. */
  loading?: boolean;
  /** Leading icon (e.g. a lucide icon at size 14/15). */
  icon?: ReactNode;
}

const base =
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out-soft " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-40";

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-emerald-300/30 bg-emerald-500 font-semibold text-emerald-950 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_8px_22px_-10px_rgba(16,185,129,0.8)] hover:bg-emerald-400 hover:shadow-glow-emerald",
  secondary:
    "border-edge-strong bg-surface-2 text-fg hover:border-emerald-500/40 hover:bg-surface-3 hover:text-white",
  ghost: "border-transparent bg-transparent text-fg-muted hover:bg-white/[0.04] hover:text-fg",
  danger: "border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-500/50 hover:bg-red-500/20",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 13 : 15;
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={clsx(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} className="shrink-0 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** Backward-compatible alias: the old bordered "ghost" button is now `variant="secondary"`. */
export function GhostButton(props: Omit<ButtonProps, "variant">) {
  return <Button variant="secondary" {...props} />;
}
