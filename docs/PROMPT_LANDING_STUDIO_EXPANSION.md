# MASTER ARCHITECTURAL BLUEPRINT & IMPLEMENTATION SPEC
## SpecShield QA — Hero Shape Expansion, Multi-SDF Morphing, Ambient Video Integration & Landing Page Prominence Overhaul

> **Target Model:** Claude (Fable 5.2 / Opus 5.5 / Claude Code)  
> **Scope:** `src/landing/**`, `src/pages/**`, `src/components/**`, `src/index.css`  
> **Goal:** Transform the visual presence of SpecShield QA. Make the hero particle shield significantly larger and commanding; add multi-shape morphing relevant to QA (Shield ➔ Matrix Lattice ➔ Playwright Prism); integrate the full-bleed ambient video asset with cyber-emerald color grading into the playground and transitions; and completely eliminate the post-hero "blank drop-off" using glowing circuit rails, super-sized retro dot-matrix typography, ambient emerald blooms, cursor spotlight cards, and an interactive mini-studio sandbox.

---

## 1. DESIGN IDENTITY & ASSET REGISTRY

### 1.1 Color Palette (Obsidian & Cyber-Emerald)
```css
:root {
  --bg-pure: #000000;
  --bg-canvas: #070a0f;
  --bg-surface: #0d131f;
  --bg-surface-elevated: #111927;
  --line: rgba(255, 255, 255, 0.08);
  --line-strong: rgba(255, 255, 255, 0.16);

  /* Primary Cyber-Shield Accents */
  --accent: #10b981;              /* Emerald 500 */
  --accent-light: #34d399;        /* Mint Sparkle */
  --accent-glow: rgba(16, 185, 129, 0.4);
  --cyan-subtle: #06b6d4;
  --amber-subtle: #f59e0b;
  --violet-subtle: #8b5cf6;

  --text-primary: #ffffff;
  --text-muted: #9ca3af;
  --text-dim: #6b7280;

  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace;
  --font-display: "BubbledotICG-FinePos", "Geist Pixel Circle", monospace;
}
```

### 1.2 Typography & Icon CDNs
* **Inter UI (Google Fonts):** `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`
* **BubbledotICG-FinePos (Display Dot-Matrix):**
  `<link href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos" rel="stylesheet" />`
* **Font Awesome 6.5.2 Brands & Solid:**
  `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css`

### 1.3 Exact Ambient Background Video Asset
```html
<video class="bg-video" autoplay muted loop playsinline preload="metadata">
  <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4" type="video/mp4" />
</video>
```
* **Styling & Color Grading:** Must be tinted in the app's obsidian & emerald tone using CSS filters and overlays:
  ```css
  .bg-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    z-index: 0;
    opacity: 0.28;
    filter: saturate(0.2) hue-rotate(95deg) brightness(0.65) contrast(1.2);
    mix-blend-mode: screen;
  }
  ```

---

## 2. PART 1: HERO SHAPE ENLARGEMENT & MULTI-SDF SHAPE MORPHING

### 2.1 Increase Existing Shape Size & Screen Presence
* **Camera Re-targeting:** In `src/landing/webgl/ShieldField.ts`, bring the camera closer from `CAMERA_BASE = new Vector3(-1.17, 0, 6.0)` to `new Vector3(-0.85, 0, 4.2)`. This increases the visual diameter of the shape by ~45%, making it dominate the right two-thirds of the hero.
* **Layout Offset Adjustment:** In `src/landing/ShieldCanvas.tsx`, adjust `offsetX` on wide displays to `0.16` (from `0.21`) and `offsetY` to `0.02` so the enlarged shape sits majestically behind the right edge without clipping.
* **Particle Count & Scale:** Maintain 262,144 particles (`512x512` texture). Increase point size uniform boost `gl_PointSize` from `0.04` to `0.055` to give the enlarged shape rich, glowing volume.

### 2.2 Adding App-Relevant Shapes (Multi-SDF Morphing)
Instead of a single static shield, implement three distinct mathematical signed distance fields in `src/landing/webgl/sdf.ts` that represent the three stages of SpecShield QA:
1. **Shape 0: The Cyber-Shield (`sdShield`)** — Represents security, air-gapped NDA protection, and the privacy boundary.
2. **Shape 1: The QA Matrix Lattice (`sdMatrixLattice`)** — A 3D cuboid grid of 4 connected hyper-columns representing the 4 test categories (Functional, Boundary, Negative, Security) with hollow nodal conduits.
   ```glsl
   float sdBox(vec3 p, vec3 b) {
     vec3 q = abs(p) - b;
     return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
   }
   float sdMatrixLattice(vec3 p) {
     vec3 cell = mod(p + 0.25, 0.5) - 0.25;
     float bars = min(min(length(cell.xy), length(cell.yz)), length(cell.zx)) - 0.035;
     float bounds = sdBox(p, vec3(0.75, 0.75, 0.2));
     return max(bars, bounds);
   }
   ```
3. **Shape 2: The Playwright Automation Prism (`sdPrismCheck`)** — An angled, faceted geometric checkmark badge representing automated assertions and green Playwright runs (`expect().toBeVisible()`).
   ```glsl
   float sdPrismCheck(vec3 p) {
     p.z = abs(p.z) - 0.08;
     // Angled checkmark segment math
     vec2 q = p.xy;
     float d1 = length(q - clamp(dot(q, vec2(0.6, 0.8)), -0.3, 0.1) * vec2(0.6, 0.8));
     float d2 = length(q - vec2(-0.25, -0.05) - clamp(dot(q - vec2(-0.25, -0.05), vec2(-0.6, 0.8)), -0.15, 0.4) * vec2(-0.6, 0.8));
     return max(min(d1, d2) - 0.08, p.z);
   }
   ```
* **Morph Uniform:** Add `uniform float uShapeIndex` (0.0 = Shield, 1.0 = Matrix Lattice, 2.0 = Playwright Prism) and `uniform float uMorphProgress` to `SIM_FRAG` and `BAKE_FRAG`.
* **Morph Triggers:** 
  * Add a sleek HUD shape-selector switch in the Hero HUD: `[ 🛡️ Shield ] [ ▦ Matrix ] [ ⚡ Test ]`.
  * As the visitor scrolls into Section 2 (How It Works), the background particle field morphs into the Matrix Lattice; in Section 3 (See It Run), it morphs into the Playwright Prism!

---

## 3. PART 2: ELIMINATING THE "BLANK FALL-OFF" AS USERS SCROLL

### 3.1 Persistent Ambient Atmosphere & Continuity
* **Cyber-Grid Spine:** In `src/landing/landing.css`, add a high-end ambient dot-grid texture running behind all sections below the hero:
  ```css
  .landing-ambient-grid {
    background-image: 
      radial-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 1px),
      radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 32px 32px, 8px 8px;
    background-position: 0 0, 16px 16px;
  }
  ```
* **Radial Emerald Energy Blooms:** Behind the Problem section, Workflow center, and Metrics, place large ambient glow blooms:
  ```css
  .ambient-bloom {
    position: absolute;
    width: 650px;
    height: 450px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(16, 185, 129, 0.03) 50%, transparent 70%);
    filter: blur(60px);
    pointer-events: none;
    z-index: 0;
  }
  ```

### 3.2 Super-Sizing the Workflow Section (Steps 01, 02, 03)
* **Giant Display Step Numbers:** Render `01`, `02`, `03` using `BubbledotICG-FinePos` at **`64px - 84px`** with a subtle mint glow (`color: #fff; text-shadow: 0 0 20px rgba(52, 211, 153, 0.4)`).
* **Animated Circuit Rails:** Connect the three step cards with an illuminated horizontal (desktop) or vertical (mobile) SVG laser path that draws and pulses as the section scrolls into view.
* **Mac-Style Studio Window Chromes:** Wrap each step's visual in an authentic mini-IDE card with traffic lights (`● ● ●`), an `offline` badge, rich syntax coloring, and color-coded test chips (Functional = Emerald, Boundary = Amber, Negative = Violet, Security = Cyan).

### 3.3 Interactive "Before / After" Mini-Studio Sandbox
Directly between Workflow and Showcase, insert a full-width interactive component:
* An **Interactive Studio Preview** with 3 tabs:
  1. `[ 📄 Raw PRD Input ]` — Shows the real Freelancer Invoice Tracker spec snippet.
  2. `[ 📊 Generated Test Matrix (30 Cases) ]` — Interactive filterable matrix table where users can click between *All*, *Functional*, *Boundary*, *Negative*, and *Security*.
  3. `[ 🎭 Playwright POM Suite ]` — Syntax-highlighted `.spec.ts` with clickable *"Copy Code"* and *"Download Demo Suite"*.
* This allows visitors to interact with the core engine directly on the landing page!

### 3.4 Browser Chrome Wrappers for Showcase Videos
* Wrap all 4 showcase videos (`spec-parsing`, `matrix-filtering`, `playwright-export`, `privacy-audit`) in sleek dark browser window shells with a faux URL bar (`https://localhost:8787/studio`), green SSL padlock, and active recording badge.
* Add cursor spotlight hover interaction (`--mouse-x`, `--mouse-y`) that illuminates the border on hover.

---

## 4. PART 3: AMBIENT VIDEO BACKGROUND FOR THE PLAYGROUND / STUDIO

* In `src/pages/Studio.tsx`, add the exact CloudFront video as a fixed ambient backdrop beneath the command center workspace:
  - Video opacity: `0.18` (low contrast so it never distracts from test editing).
  - Overlay gradient: Obsidian canvas `#070a0f` at 85% opacity with a top-to-bottom fade.
  - Gives the Studio a breathing, living, high-tech command center atmosphere.
* Strip all internal developer plumbing from the Studio:
  - Header displays: `SpecShield QA` + `[ ● Local Offline Engine ]`.
  - Privacy Receipt: `🔒 Air-Gapped: 0 Outbound Packets | $0.00 Cloud Cost`.
  - Clean 2-column layout: Spec Editor on left, Matrix & Code on right.
  - Minimal footer with GitHub and MIT license links.

---

## 5. VERIFICATION & ACCEPTANCE CRITERIA

1. `npm run typecheck` passes with zero errors.
2. `npm run build` succeeds cleanly.
3. The hero 3D particle shape is ~45% larger, commanding the right two-thirds of the hero.
4. Shape morphing HUD allows toggling between Shield, Matrix Lattice, and Playwright Prism.
5. As the user scrolls past the hero, the background does NOT fall flat black; it features ambient emerald blooms, dot-grid textures, and illuminated circuit rails.
6. The interactive 3-tab Mini-Studio sandbox functions smoothly on the landing page.
7. The ambient background video runs smoothly at low opacity behind the Studio workspace.
