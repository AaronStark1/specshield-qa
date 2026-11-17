import { useId } from "react";

const OUTLINE = "M200 34 344 96v150c0 14-6 27-16 37L200 426 72 283c-10-10-16-23-16-37V96L200 34Z";

/** Static, glowing dot-matrix shield shown instead of the WebGL simulation (reduced motion / no WebGL). */
export function StaticShield() {
  const id = useId();
  const dots = `${id}-dots`;
  const shade = `${id}-shade`;
  const glow = `${id}-glow`;
  const mask = `${id}-mask`;
  return (
    <svg viewBox="0 0 400 460" className="h-[min(56vh,520px)] w-auto" role="img" aria-label="SpecShield emblem">
      <defs>
        <pattern id={dots} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.25" fill="#fff" />
        </pattern>
        <linearGradient id={shade} x1="60" y1="30" x2="340" y2="430" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a7f3d0" />
          <stop offset="0.35" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <mask id={mask}>
          <path d={OUTLINE} fill={`url(#${dots})`} />
          <ellipse cx="200" cy="214" rx="62" ry="76" fill="#000" />
        </mask>
      </defs>
      <path d={OUTLINE} fill="#10b981" opacity="0.28" filter={`url(#${glow})`} />
      <ellipse cx="200" cy="214" rx="62" ry="76" fill="#000" />
      <rect width="400" height="460" fill={`url(#${shade})`} mask={`url(#${mask})`} />
      <path d={OUTLINE} fill="none" stroke={`url(#${shade})`} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="200" cy="214" rx="62" ry="76" fill="none" stroke={`url(#${shade})`} strokeWidth="2.5" />
    </svg>
  );
}
