/**
 * The reel's shots: what capture.mjs films in the real app. Times are seconds from the shot's
 * first frame. `cursor` keys glide between targets (a target resolves to the element's centre
 * when its segment starts, so it can be something an earlier click revealed); `clicks` press at
 * those times; `anchors` are element rects recorded every frame for the compositor's camera.
 * The comment on each shot gives where it sits in the 40 s reel (showreel.html).
 */

/** Centre of a Playwright locator, nudged by (dx, dy). */
const centre = (locate, dx = 0, dy = 0) => async (ctx) => {
  const b = await ctx.box(locate(ctx.page));
  return [b.cx + dx, b.cy + dy];
};
const hudButton = (n) => centre((p) => p.locator(".shape-switcher:visible button").nth(n));
const clickHud = (n) => (ctx) => ctx.js((i) => [...document.querySelectorAll(".shape-switcher")].find((s) => s.getClientRects().length)?.querySelectorAll("button")[i]?.click(), n);

/** Landing shots start from a formed shield, so a section can be scrolled to on the first frame. */
async function landingAt(ctx, selector, offset) {
  await ctx.landingReady();
  await ctx.preroll(3);
  ctx.vars.top = (await ctx.docTop(selector)) + offset;
}

export const SHOTS = {
  /** Reel 1.3–4.4: the problem section, risk card then solution card. */
  P: {
    path: "/",
    duration: 3.4,
    prepare: (ctx) => landingAt(ctx, "#problem", -40),
    scroll: (t, ctx) => ctx.vars.top,
    anchors: {
      risk: { sel: "#problem article", nth: 0 },
      solution: { sel: "#problem article", nth: 1 },
      title: { sel: "#problem-title" },
    },
  },

  /** Reel 3.8–12.8: the hero from page load. Particles condense into the shield, the cursor stirs
   *  the fluid, then the HUD morphs it into the QA Matrix Lattice (reel 8.5) and the Playwright Prism (10.5). */
  H: {
    path: "/",
    duration: 9.0,
    prepare: (ctx) => ctx.landingReady(),
    cursor: [
      { at: 0, to: "off" },
      { at: 2.3, to: [1995, 300] },
      { at: 3.3, to: [1150, 470] },
      { at: 3.95, to: [1430, 690] },
      { at: 4.55, to: hudButton(1) },
      { at: 5.6, to: hudButton(1) },
      { at: 6.55, to: hudButton(2) },
      { at: 7.4, to: hudButton(2) },
      { at: 8.6, to: [1590, 850] },
    ],
    clicks: [4.7, 6.7],
    anchors: {
      hud: { sel: ".shape-switcher", visible: true },
      title: { sel: "#hero-title" },
      cta: { sel: "#overview a.cta-matrix" },
    },
  },

  /** Reel 12.35–16.4: "How it works" while the field morphs from the prism into the lattice;
   *  ends on the header's Launch Studio (reel 15.5), which the shield iris opens into the studio. */
  W: {
    path: "/",
    duration: 4.0,
    async prepare(ctx) {
      await ctx.landingReady();
      await ctx.preroll(2.8);
      await clickHud(2)(ctx);
      await ctx.preroll(2.3);
      ctx.vars.top = (await ctx.docTop("#how-it-works")) + 10;
      await ctx.blockNavigation(".landing-header a.cta-matrix");
    },
    scroll: (t, ctx) => ctx.vars.top,
    cursor: [
      { at: 0, to: "off" },
      { at: 2.05, to: [1700, 1095] },
      { at: 2.95, to: centre((p) => p.locator(".landing-header a.cta-matrix"), -8, 2) },
      { at: 4.0, to: centre((p) => p.locator(".landing-header a.cta-matrix"), -8, 2) },
    ],
    clicks: [3.1],
    anchors: {
      launch: { sel: ".landing-header a.cta-matrix" },
      section: { sel: "#how-it-works" },
      title: { sel: "#how-it-works h2" },
    },
  },

  /** Reel 15.4–31.4: the studio, from an empty editor to a generated suite. Clicks land on beats:
   *  sample 17.0, generate 18.5, Security 21.0, FIT-SEC-001 22.0, Playwright 23.5, login.page.ts 25.0,
   *  Copy Suite 26.5, Value estimate 28.5. Film it against an API with no run history: the studio
   *  reopens the latest run on load, which would fill the matrix before Generate is pressed. */
  S: {
    path: "/studio",
    duration: 16.0,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector("textarea"), "the studio");
      await ctx.preroll(1.2);
    },
    cursor: [
      { at: 0, to: "off" },
      { at: 0.85, to: [760, 1095] },
      { at: 1.45, to: centre((p) => p.getByRole("button", { name: "Invoice Tracker" })) },
      { at: 1.8, to: centre((p) => p.getByRole("button", { name: "Invoice Tracker" })) },
      { at: 2.9, to: centre((p) => p.getByRole("button", { name: "Generate test suite" }), -60, 0) },
      { at: 3.4, to: centre((p) => p.getByRole("button", { name: "Generate test suite" }), -60, 0) },
      { at: 5.35, to: centre((p) => p.locator("#panel-matrix").getByRole("button", { name: /^Security/ })) },
      { at: 5.8, to: centre((p) => p.locator("#panel-matrix").getByRole("button", { name: /^Security/ })) },
      { at: 6.4, to: centre((p) => p.locator("tbody tr").first(), -330, 0) },
      { at: 6.9, to: centre((p) => p.locator("tbody tr").first(), -330, 0) },
      { at: 7.9, to: centre((p) => p.getByRole("tab", { name: /Playwright Code/ })) },
      { at: 8.35, to: centre((p) => p.getByRole("tab", { name: /Playwright Code/ })) },
      { at: 9.4, to: centre((p) => p.getByRole("tab", { name: /login\.page\.ts/ })) },
      { at: 9.85, to: centre((p) => p.getByRole("tab", { name: /login\.page\.ts/ })) },
      { at: 10.9, to: centre((p) => p.getByRole("button", { name: "Copy Suite" })) },
      { at: 11.45, to: centre((p) => p.getByRole("button", { name: "Copy Suite" })) },
      { at: 12.9, to: centre((p) => p.locator("summary", { hasText: "Value estimate" }), -150, 0) },
      { at: 13.4, to: "hold" },
      { at: 14.05, to: "hold" },
      { at: 14.9, to: centre((p) => p.getByRole("region", { name: "Privacy" }), -40, 14) },
    ],
    clicks: [1.6, 3.1, 5.6, 6.6, 8.1, 9.6, 11.1, 13.1],
    events: [
      // The offline engine answers in milliseconds; hold virtual time until its result is on screen.
      { at: 3.19, run: (ctx) => ctx.poll(() => ctx.js(() => /Completed in/.test(document.body.innerText)), "the run to complete") },
      { at: 3.2, run: () => new Promise((r) => setTimeout(r, 400)) },
      // The opened value estimate runs past the fold: scroll just far enough to show all of it.
      {
        at: 13.22,
        run: async (ctx) => {
          ctx.vars.roi = await ctx.js(() => {
            const r = document.querySelector("details.panel").getBoundingClientRect();
            return Math.max(0, Math.ceil(r.bottom + window.scrollY - 1050));
          });
        },
      },
    ],
    scroll: (t, ctx) => (t < 13.22 ? 0 : (ctx.vars.roi ?? 0) * (t >= 13.95 ? 1 : (1 - Math.cos(Math.PI * ((t - 13.22) / 0.73))) / 2)),
    anchors: {
      spec: { sel: "section[aria-label='Specification'] .panel", nth: 0 },
      progress: { sel: "section[aria-label='Run progress']" },
      done: { sel: "[role='status']", text: "Completed in" },
      tabs: { sel: "[role='tablist'][aria-label='Output']" },
      output: { sel: "section[aria-label='Generated output']" },
      privacy: { sel: "section[aria-label='Privacy']" },
      value: { sel: "details.panel" },
    },
  },

  /** Reel 30.75–35.75: "Nothing leaves. Nothing is billed." — the counters run as it scrolls in. */
  M: {
    path: "/",
    duration: 5.0,
    prepare: (ctx) => landingAt(ctx, "#security", 0),
    scroll: (t, ctx) => ctx.vars.top,
    anchors: {
      title: { sel: "#metrics-title" },
      section: { sel: "#security" },
      closing: { sel: ".text-matrix-gradient", text: "Keep the spec" },
    },
  },

  /** Reel 35.0–39.8: the field alone, Playwright Prism morphing back into the Cyber-Shield. */
  E: {
    path: "/",
    duration: 4.8,
    css: ".landing-header, #overview .landing-container, .hero-hud, .shape-switcher, #overview > a, .hero-ambient, .hero-shade, .landing-ambient-grid, footer { opacity: 0 !important; }",
    async prepare(ctx) {
      await ctx.landingReady();
      await ctx.preroll(2.8);
      await clickHud(2)(ctx);
      await ctx.preroll(2.4);
    },
    events: [{ at: 0.3, run: clickHud(0) }],
  },
};
