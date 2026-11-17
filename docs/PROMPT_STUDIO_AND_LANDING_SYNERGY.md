# MASTER SPECIFICATION: CYBER-MATRIX STUDIO & GREEN THEMATIC HARMONY
## SpecShield QA — Pure Cyber-Emerald Aesthetic: Eliminating Stark White, Boosting Studio Atmosphere & Harmonizing the Matrix Theme

> **Target Tool:** Fable 5.2 / Claude Code / Claude Opus 5.5  
> **Key Files to Modify:**
> - `src/pages/Studio.tsx` & `src/pages/Landing.tsx`
> - `src/components/layout/Header.tsx`, `AmbientVideo.tsx`, `Footer.tsx`
> - `src/landing/LandingHeader.tsx`, `Hero.tsx`, `WorkflowSection.tsx`, `landing.css`
> - `src/index.css` & `tailwind.config.ts`

---

## 1. DESIGN DIRECTIVE: PURGE THE WHITE, EMBRACE THE MATRIX

### 1.1 The Core Problem
The stark white navbar pill, white logo circle, and plain white CTAs look like an iOS widget dropped onto an elite cyberpunk interface. They cause visual glare and completely break the immersion of the green particle universe.

### 1.2 The New Rules
1. **NO STARK WHITE PILLS:** Replace all white navigation backgrounds, white brand buttons, and white outer badges with **translucent obsidian glass + neon emerald borders**.
2. **BRIGHTER & PROMINENT STUDIO BACKGROUND:** The ambient video in the Studio must not be drowned in dark mud. Boost opacity to **`0.42`**, raise brightness to **`1.05`**, and grade it into vivid bioluminescent emerald so its moving energy ripples clearly behind floating frosted panels.
3. **GREEN/MINT THEMATIC COHESION:** 
   - Headlines use white-to-mint gradient lettering (`linear-gradient(180deg, #ffffff 30%, #34d399 100%)`).
   - CTAs use vibrant emerald gradients with multi-layered neon green glows.
   - All trust badges, cards, and borders carry green matrix accents, circuit lines, and pulsing radar dots.

---

## 2. DESIGN TOKENS & CYBER-EMERALD PALETTE

```css
:root {
  --bg-pure: #000000;
  --bg-canvas: #05080c;
  --bg-surface: rgba(10, 16, 26, 0.72);
  --bg-surface-elevated: rgba(14, 22, 36, 0.85);

  /* Cyber-Matrix Emerald & Mint Palette */
  --accent: #10b981;              /* Primary Emerald 500 */
  --accent-light: #34d399;        /* Neon Mint Sparkle */
  --accent-bright: #6ee7b7;       /* Cyber Highlight */
  --accent-deep: #064e3b;         /* Deep Matrix Green */
  --accent-glow: 0 0 28px rgba(16, 185, 129, 0.45);
  --accent-glow-intense: 0 0 45px rgba(16, 185, 129, 0.7);

  /* Borders & Circuit Linework */
  --line-matrix: rgba(16, 185, 129, 0.22);
  --line-matrix-strong: rgba(52, 211, 153, 0.45);
  --line-glass: rgba(255, 255, 255, 0.08);

  /* Typography */
  --text-primary: #f0fdf4;       /* Mint-tinted crisp white */
  --text-muted: #94a3b8;
  --text-dim: #64748b;
  --text-matrix: #34d399;

  --font-sans: "Inter", "Segoe UI", system-ui, sans-serif;
  --font-mono: "SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace;
  --font-display: "BubbledotICG-FinePos", "Geist Pixel Circle", monospace;
}
```

---

## 3. PART 1: THE CYBER-MATRIX TOP NAVIGATION BAR (LANDING & STUDIO)

Both the Landing Page and Studio share this unified, living Cyber-Glass command bar:

### 3.1 Structure & Styling
* **Shell:** Floating centered pill, height `48px`, max-width `740px`.
* **Glass Texture:** `background: rgba(7, 12, 19, 0.82)`, `backdrop-filter: blur(20px)`, `border: 1px solid var(--line-matrix)`.
* **Animated Circuit Beam:** A subtle, continuous 1.8s glowing emerald beam sliding around the outer rim of the nav.
* **Brand Mark (Left):** 
  - Size `38px` rounded hex/circle.
  - Dark glass background with a glowing emerald border (`box-shadow: 0 0 14px rgba(16, 185, 129, 0.3)`).
  - Neon green shield icon inside with a subtle pulsing radar ping.
  - Text: `SPECSHIELD` in mint-white with `QA` in a glowing emerald tag.

### 3.2 Nav Links & Category Color-Coding (Center)
* Nav Links: `[ 📄 Editor ]`, `[ ▦ QA Matrix ]`, `[ ⚡ Playwright ]`, `[ 🔒 Security ]`.
* **Active State:** 
  - An illuminated sliding mint pill behind the active tab (`background: rgba(16, 185, 129, 0.16); border: 1px solid rgba(52, 211, 153, 0.4); box-shadow: 0 0 15px rgba(16, 185, 129, 0.25)`).
  - A glowing emerald beacon dot `●` anchored directly below the active label.
* **Hover State:** Soft text lift to neon mint (`#34d399`) with an interactive cursor spotlight.

### 3.3 Engine Beacon & Run Action (Right)
* **Engine Beacon Pill:** Dark glass `#0b131e` with a live pulsing green status:
  `[ ● Local Gemma 9B · Offline ]` (amber when in fallback mode).
* **Launch / Run Action:** High-energy neon emerald button:
  `background: linear-gradient(135deg, #10b981 0%, #059669 100%)`, text `#022c22` (deepest forest green/black), bold, with a soft neon aura.

---

## 4. PART 2: PROMINENT & LUMINOUS STUDIO BACKGROUND

The studio currently feels too dark and stagnant. We elevate it into a vibrant, living cybersecurity terminal.

### 4.1 Ambient Video Grade (Prominent & Bioluminescent)
* **Video Opacity:** Increased from `0.18` to **`0.42`**.
* **Filter Chain:**
  ```css
  .studio-ambient .bg-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    z-index: 0;
    opacity: 0.42;
    filter: saturate(1.2) hue-rotate(85deg) brightness(1.05) contrast(1.25);
    mix-blend-mode: screen;
  }
  ```
* **Luminous Gradient Tint:**
  ```css
  .studio-ambient-tint {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 60% 30%, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.08) 50%, transparent 80%);
    mix-blend-mode: color;
    pointer-events: none;
  }
  ```
* **Lighter Obsidian Veil:**
  ```css
  .studio-ambient-veil {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(5, 8, 12, 0.75) 0%, rgba(5, 8, 12, 0.35) 45%, rgba(5, 8, 12, 0.65) 100%);
    pointer-events: none;
  }
  ```

### 4.2 Frosted Glass Workspace Panels
* Convert `SpecEditor`, `WorkspaceTabs`, and `PipelineProgress` into floating, translucent cyber-slates:
  ```css
  .panel, .studio-panel {
    background: rgba(8, 14, 22, 0.68) !important;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(16, 185, 129, 0.16) !important;
    box-shadow: 0 16px 45px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    border-radius: 14px;
  }
  .panel:hover, .studio-panel:hover {
    border-color: rgba(52, 211, 153, 0.35) !important;
    box-shadow: 0 16px 45px -10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(16, 185, 129, 0.12);
  }
  ```

### 4.3 Live Tabular Matrix Stats Bar
Docked at the bottom of the studio, glowing in matrix green:
* `< 120ms` · Latency / Turnaround
* `100%` · Air-Gapped (0 Bytes Sent)
* `$0.00` · Cloud Cost / Token Spend
* `30+` · Verified Playwright POM Tests
Numbers rendered in `BubbledotICG-FinePos` glowing with an emerald shadow (`text-shadow: 0 0 18px rgba(16, 185, 129, 0.5)`).

---

## 5. PART 3: RE-THEMING THE LANDING PAGE (MORE GREEN, REDUCING WHITE)

### 5.1 Hero Section Re-Theming
1. **Headline (Gradient-Infused Matrix Glow):**
   - Replace solid flat white with a radiant mint-fade in `BubbledotICG-FinePos`:
     ```css
     .hero-title {
       background: linear-gradient(180deg, #ffffff 25%, #6ee7b7 75%, #10b981 100%);
       -webkit-background-clip: text;
       -webkit-text-fill-color: transparent;
       filter: drop-shadow(0 0 24px rgba(16, 185, 129, 0.3));
     }
     ```
2. **Hero CTA Button:**
   - Ditch the white button. Replace with the **Luminous Matrix Pill**:
     - `background: linear-gradient(135deg, #10b981 0%, #059669 100%)`.
     - Text: `#022c22` (deep contrast forest green), Inter 600.
     - Halo glow: `box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.4), 0 0 30px rgba(16, 185, 129, 0.55), 0 0 60px rgba(16, 185, 129, 0.2)`.
     - Hover: `transform: translateY(-2px) scale(1.02); filter: brightness(1.1)`.
3. **Trust Row:**
   - Overlapping avatar rings use **dark obsidian glass** with glowing emerald rims (`border: 1px solid rgba(52, 211, 153, 0.4)`), not white circles.
   - Brand icons tinted in soft mint `#6ee7b7`.
   - Trust Pill: `background: rgba(10, 16, 26, 0.8)`, border `var(--line-matrix)`, text `#a7f3d0` (`Trusted by 2,000+ QA & Security Teams`).

### 5.2 Scroll Sections: Green Matrix Atmosphere
1. **Circuit Linework & Ambient Grid:**
   - Replace generic white dot grid with an **emerald cyber-grid**:
     `background-image: radial-gradient(rgba(16, 185, 129, 0.12) 1px, transparent 1px)`.
   - Add luminous green SVG circuit connector paths connecting Workflow Steps 01 ➔ 02 ➔ 03.
2. **Step Numbers in BubbledotICG-FinePos:**
   - Render `01`, `02`, `03` in neon mint `#34d399` with glowing emerald back-drops.
3. **Interactive Mini-Studio:**
   - Styled as an authentic glowing green terminal window with traffic lights (`● ● ●`), active test filter chips in matrix colors (Functional = Emerald, Boundary = Amber, Negative = Violet, Security = Cyan), and ready-to-copy code.

---

## 6. VERIFICATION & ACCEPTANCE CRITERIA

1. Zero stark white navigation pills or stark white buttons remain on the site.
2. Both Landing and Studio use the unified Cyber-Glass top nav with the animated emerald rim and sliding mint active pill.
3. The ambient video in the Studio is prominently visible, crisp, and ripples with bright bioluminescent emerald motion behind frosted glass panels.
4. Headlines and CTAs carry the signature green-to-mint gradients and multi-layered emerald halos.
5. `npm run typecheck` and `npm run build` pass cleanly with zero errors.
