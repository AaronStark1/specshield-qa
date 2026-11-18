#!/usr/bin/env node
/**
 * Captures the reel's shots from the real app, frame by frame, under virtual time.
 *
 *   node capture.mjs                 # every shot in shots.mjs → out/shots/<id>/ (180 fps JPEGs + meta.json)
 *   node capture.mjs S H             # only these shots
 *   node capture.mjs P --sheet       # also tile one frame per 0.25 s into out/shots/<id>-sheet.jpg
 *
 * Needs the app running with the offline engine and no tracing, e.g. a private stack whose
 * DATA_DIR is a new, empty folder (the studio reopens the latest run, and shot S must start empty):
 *   PORT=8799 DATA_DIR=<empty scratch dir> FORCE_FALLBACK=true SENTRY_DSN= npx tsx server/index.ts
 *   API_PROXY_TARGET=http://localhost:8799 npx vite --port 5175 --strictPort      (BASE defaults to :5175)
 *
 * Each shot runs in its own browser context with lib/vclock.js installed, so the page only moves
 * when a frame is taken: three subframes per 60 fps frame, which the compositor averages into
 * motion blur. Pointer moves, clicks and scrolls are scripted per subframe in shots.mjs.
 */
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";
import { VCLOCK_SCRIPT } from "./lib/vclock.js";
import { SHOTS } from "./shots.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "out", "shots");
const BASE = process.env.BASE ?? "http://localhost:5175";
export const SUB_FPS = 180;
const STEP_MS = 1000 / SUB_FPS;
const VIEWPORT = { width: 1920, height: 1080 };
/** Hosts a landing-page shot may contact: the display face the page itself loads. */
const LANDING_HOSTS = ["db.onlinewebfonts.com"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp01 = (u) => Math.min(1, Math.max(0, u));
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err.slice(-600)}`))));
  });
}

/** Polls from Node in real time, leaving virtual time where it is. */
async function poll(check, what, timeout = 20000) {
  const started = Date.now();
  for (;;) {
    if (await check()) return;
    if (Date.now() - started > timeout) throw new Error(`timed out waiting for ${what}`);
    await sleep(40);
  }
}

/** Helpers a shot's prepare/events receive. */
function makeContext(page) {
  const ctx = {
    page,
    vars: {},
    js: (fn, arg) => page.evaluate(fn, arg),
    poll,
    /** Advances virtual time without taking frames, a few steps per round trip so the page can render in between. */
    async preroll(seconds) {
      let left = Math.round(seconds * SUB_FPS);
      while (left > 0) {
        const n = Math.min(6, left);
        await page.evaluate(async ([k, ms]) => {
          for (let i = 0; i < k; i++) await window.__vt.step(ms);
        }, [n, STEP_MS]);
        left -= n;
      }
    },
    /** Viewport rect of a Playwright locator, with its centre. */
    async box(locator) {
      const b = await locator.boundingBox();
      if (!b) throw new Error(`not visible: ${locator}`);
      return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
    },
    /** Document offset of the first element matching a CSS selector. */
    docTop: (selector) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY, selector),
    /**
     * Steps virtual time until the page predicate holds. React reveals lazily loaded pages on a
     * Suspense timer, which now runs on virtual time, so a page only mounts while time moves.
     */
    async until(predicate, what, maxSeconds = 4) {
      for (let i = 0; i < maxSeconds * SUB_FPS; i++) {
        if (await page.evaluate(predicate)) return;
        await page.evaluate((ms) => window.__vt.step(ms), STEP_MS);
        await sleep(8);
      }
      throw new Error(`timed out waiting for ${what}`);
    },
    /** The landing page is ready: React mounted, the particle field running, the display face loaded. */
    async landingReady() {
      await ctx.until(() => /particles/i.test(document.querySelector(".hero-hud")?.textContent ?? ""), "the particle field");
      await poll(
        () => page.evaluate(async () => {
          await document.fonts.ready;
          return document.fonts.check('48px "BubbledotICG-FinePos"');
        }),
        "the BubbledotICG display face",
        25000,
      ).catch(() => console.warn("  display face did not load; the page falls back to Geist Pixel Circle"));
    },
    /** Clicks on this link run its handlers but do not navigate, so the shot keeps the page. */
    blockNavigation: (selector) =>
      page.evaluate((s) => {
        document.addEventListener("click", (e) => e.target instanceof window.Element && e.target.closest(s) && e.preventDefault(), true);
      }, selector),
  };
  return ctx;
}

/** Resolves a cursor key target to viewport coordinates. */
async function resolveTarget(ctx, to) {
  if (to === "off") return null;
  if (Array.isArray(to)) return { x: to[0], y: to[1] };
  const p = await to(ctx);
  return Array.isArray(p) ? { x: p[0], y: p[1] } : p;
}

/**
 * Cursor position at t from the shot's keys; targets resolve the first time a segment needs them.
 * A "hold" key stays where the previous key was, so the page can scroll under a resting pointer.
 */
function makeCursor(ctx, keys = []) {
  const resolved = new Map();
  const at = async (i) => {
    if (!resolved.has(i)) resolved.set(i, keys[i].to === "hold" ? await at(i - 1) : await resolveTarget(ctx, keys[i].to));
    return resolved.get(i);
  };
  return async (t) => {
    if (keys.length === 0 || t < keys[0].at) return null;
    let i = 0;
    while (i + 1 < keys.length && t >= keys[i + 1].at) i++;
    const a = await at(i);
    if (i + 1 >= keys.length || !a) return a;
    const b = await at(i + 1);
    if (!b) return a;
    const u = easeInOut(clamp01((t - keys[i].at) / (keys[i + 1].at - keys[i].at)));
    // a gentle bow, as a hand moves
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, bow = Math.min(60, len * 0.12) * Math.sin(Math.PI * u);
    return { x: a.x + dx * u - (dy / len) * bow, y: a.y + dy * u + (dx / len) * bow };
  };
}

const ANCHOR_FN = (specs) =>
  Object.fromEntries(
    Object.entries(specs).map(([name, s]) => {
      let els = [...document.querySelectorAll(s.sel)];
      if (s.text) els = els.filter((e) => (e.textContent ?? "").includes(s.text));
      if (s.visible) els = els.filter((e) => e.getClientRects().length > 0 && window.getComputedStyle(e).visibility !== "hidden");
      const el = els[s.nth ?? 0];
      if (!el) return [name, null];
      const r = el.getBoundingClientRect();
      return [name, [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10)];
    }),
  );

async function captureShot(browser, id) {
  const shot = SHOTS[id];
  if (!shot) throw new Error(`unknown shot ${id}`);
  const dsf = shot.dsf ?? 1.25;
  const dir = path.join(OUT, id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: dsf,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript(VCLOCK_SCRIPT);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`  [${id}] page error:`, e.message));
  const baseHost = new URL(BASE).host;
  const external = new Set();
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.host !== baseHost) external.add(u.host);
  });

  await page.goto(BASE + shot.path, { waitUntil: "networkidle" });
  const ctx = makeContext(page);
  if (shot.css) await page.addStyleTag({ content: shot.css });
  await shot.prepare?.(ctx);
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height + 40);

  const cursorAt = makeCursor(ctx, shot.cursor);
  const clicks = (shot.clicks ?? []).map((c) => ({ down: c, up: c + 0.08, state: 0 }));
  const events = (shot.events ?? []).map((e) => ({ ...e, done: false }));
  const total = Math.round(shot.duration * SUB_FPS);
  const meta = { id, fps: SUB_FPS, dsf, width: VIEWPORT.width, height: VIEWPORT.height, frames: [] };
  const started = Date.now();
  let pressed = false;

  for (let i = 0; i < total; i++) {
    const t = i / SUB_FPS;
    for (const e of events) {
      if (!e.done && t >= e.at) {
        e.done = true;
        await e.run(ctx);
      }
    }
    const m = await cursorAt(t);
    if (m) await page.mouse.move(m.x, m.y);
    for (const c of clicks) {
      if (c.state === 0 && t >= c.down) {
        await page.mouse.down();
        c.state = 1;
        pressed = true;
      } else if (c.state === 1 && t >= c.up) {
        await page.mouse.up();
        c.state = 2;
        pressed = false;
        if (shot.afterClick) await shot.afterClick(ctx, c.down);
      }
    }
    const y = shot.scroll ? shot.scroll(t, ctx) : null;
    await page.evaluate(([top, ms]) => {
      if (top !== null) window.scrollTo({ top, behavior: "instant" });
      return window.__vt.step(ms);
    }, [y, i === 0 ? 0 : STEP_MS]);
    const frame = { m: m ? [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, pressed ? 1 : 0] : null };
    if (shot.anchors && i % 3 === 0) frame.a = await page.evaluate(ANCHOR_FN, shot.anchors);
    meta.frames.push(frame);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
    if ((i + 1) % 360 === 0) console.log(`  [${id}] ${i + 1}/${total} subframes, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }

  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta));
  await context.close();
  const allowed = shot.path.startsWith("/studio") ? [] : LANDING_HOSTS;
  const stray = [...external].filter((h) => !allowed.includes(h));
  if (stray.length) throw new Error(`[${id}] the page contacted ${stray.join(", ")} during the shot`);
  console.log(`  [${id}] done: ${total} subframes in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  return dir;
}

/** One frame every 0.25 s of a captured shot, tiled for review. */
async function sheet(id) {
  const dir = path.join(OUT, id);
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
  const pick = files.filter((_, i) => i % 45 === 0);
  const tmp = path.join(OUT, `${id}-sheet-src`);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp);
  await Promise.all(pick.map((f, i) => fs.copyFile(path.join(dir, f), path.join(tmp, `${String(i).padStart(3, "0")}.jpg`))));
  const cols = 5, rows = Math.ceil(pick.length / cols);
  await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-i", path.join(tmp, "%03d.jpg"), "-vf", `scale=480:270,tile=${cols}x${rows}:padding=6:margin=6:color=0x222222`, "-frames:v", "1", path.join(OUT, `${id}-sheet.jpg`)]);
  await fs.rm(tmp, { recursive: true, force: true });
  return path.join(OUT, `${id}-sheet.jpg`);
}

export async function captureShots(ids, { workers = 3, sheets = false } = {}) {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--force-color-profile=srgb", "--hide-scrollbars"],
  });
  try {
    const queue = [...ids];
    await Promise.all(
      [...Array(Math.min(workers, queue.length))].map(async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          console.log(`shot ${id}: ${SHOTS[id].duration}s`);
          await captureShot(browser, id);
          if (sheets) console.log(`  sheet: ${await sheet(id)}`);
        }
      }),
    );
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const ids = argv.filter((a) => !a.startsWith("--"));
  const workerArg = argv.indexOf("--workers");
  captureShots(ids.length ? ids.filter((a) => SHOTS[a]) : Object.keys(SHOTS), {
    workers: workerArg >= 0 ? Number(argv[workerArg + 1]) : Math.max(1, Math.min(3, os.cpus().length - 4)),
    sheets: argv.includes("--sheet"),
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
