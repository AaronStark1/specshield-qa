import { useId } from "react";

export interface ShieldMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/** SpecShield logo: the six-sided shield with its open core, matching the particle shield on the landing page. */
export function ShieldMark({ size = 24, className, title }: ShieldMarkProps) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.6 27 7.2v9.6c0 1 -.45 1.95 -1.2 2.6L16 29.4 6.2 19.4A3.5 3.5 0 0 1 5 16.8V7.2L16 2.6Z"
        fill={`url(#${gradientId})`}
        fillOpacity="0.16"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <ellipse cx="16" cy="14.6" rx="3.7" ry="4.5" stroke={`url(#${gradientId})`} strokeWidth="1.8" />
    </svg>
  );
}
