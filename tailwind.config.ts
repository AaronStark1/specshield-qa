import type { Config } from "tailwindcss";

/**
 * SpecShield QA design tokens — "Cyber-Shield Command Center".
 *
 * Status colours intentionally map onto Tailwind's built-in palettes so components
 * can use e.g. `text-emerald-300` / `border-violet-500/40` directly:
 *   emerald-500 #10B981 → local execution, success, Functional tests
 *   amber-500   #F59E0B → warnings, Boundary tests, deterministic fallback
 *   violet-500  #8B5CF6 → agent processing, Negative tests, token activity
 *   cyan-500    #06B6D4 → Security tests, tracing, locators
 *   red-500     #EF4444 → failures, critical findings (use at low alpha)
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#070A0F",
        surface: { DEFAULT: "#0D131F", 1: "#0D131F", 2: "#111927", 3: "#162033" },
        edge: { DEFAULT: "rgba(255,255,255,0.08)", strong: "rgba(255,255,255,0.14)", faint: "rgba(255,255,255,0.05)" },
        fg: { DEFAULT: "#E5E7EB", muted: "#9CA3AF", dim: "#6B7280", faint: "#4B5563" },
        // legacy alias kept so older class names keep compiling
        ink: "#070A0F",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["10.5px", { lineHeight: "14px", letterSpacing: "0.02em" }],
        "13": ["13px", { lineHeight: "18px" }],
      },
      borderRadius: { panel: "10px" },
      boxShadow: {
        panel: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px -18px rgba(0,0,0,0.8)",
        "glow-emerald": "0 0 0 1px rgba(16,185,129,0.35), 0 0 22px -4px rgba(16,185,129,0.45)",
        "glow-violet": "0 0 0 1px rgba(139,92,246,0.35), 0 0 22px -4px rgba(139,92,246,0.5)",
        "glow-amber": "0 0 0 1px rgba(245,158,11,0.35), 0 0 22px -4px rgba(245,158,11,0.45)",
        "glow-cyan": "0 0 0 1px rgba(6,182,212,0.35), 0 0 22px -4px rgba(6,182,212,0.45)",
        "glow-red": "0 0 0 1px rgba(239,68,68,0.35), 0 0 22px -4px rgba(239,68,68,0.45)",
      },
      transitionTimingFunction: { "out-soft": "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      keyframes: {
        "status-pulse": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        beam: { "0%": { transform: "translateX(-120%)" }, "100%": { transform: "translateX(260%)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "fade-in": { "0%": { opacity: "0", transform: "translateY(2px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "status-pulse": "status-pulse 2s ease-in-out infinite",
        beam: "beam 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "fade-in": "fade-in 180ms ease-out both",
      },
    },
  },
  plugins: [],
} as Config;
