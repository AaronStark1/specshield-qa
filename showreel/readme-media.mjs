#!/usr/bin/env node
/**
 * Builds the README's media from the shots capture.mjs filmed (out/shots) into ../docs/readme/.
 *
 *   node readme-media.mjs                 # everything
 *   node readme-media.mjs hero generate   # only these items
 *
 * Clips are animated WebP, because GitHub plays no MP4 from a repository but renders images from
 * it: a crop of one shot at a fixed frame rate, with the reel's cursor drawn from meta.json, on a
 * rounded card with an emerald hairline. Studio clips end in a caption bar set in the landing
 * page's display face. The hero loops seamlessly by cross-fading its tail into its head. The
 * title card is rendered once per GitHub theme, and the screens are WebP previews of the
 * full-size screenshots in docs/.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SHOTS = path.join(here, "out", "shots");
const WORK = path.join(here, "out", "readme");
const OUT = path.join(root, "docs", "readme");
const ORIGIN = "http://readme.local";
const SUB_FPS = 180;
const DISPLAY_CSS = "https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos";

/**
 * crop: [x, y, w, h] in CSS px of the 1920×1080 viewport; from/to: seconds into the shot;
 * hold: seconds the last frame stays up before the loop restarts; loop: cross-fade seconds.
 */
const CLIPS = {
  hero: { shot: "H", from: 3.0, to: 8.6, loop: 0.6, fps: 15, width: 960, crop: [0, 0, 1920, 1080], quality: 75 },
  generate: {
    shot: "S", from: 0.85, to: 4.75, hold: 1.6, fps: 20, width: 1200, crop: [80, 0, 1760, 990],
    caption: ["01", "Paste a spec, press Generate", "Invoice Tracker sample · 30 cases"],
  },
  matrix: {
    shot: "S", from: 5.15, to: 7.5, hold: 1.6, fps: 20, width: 1200, crop: [790, 206, 1034, 508],
    caption: ["02", "Filter the matrix, open a case", "Security · Given / When / Then"],
  },
  code: {
    shot: "S", from: 7.7, to: 11.7, hold: 1.4, fps: 20, width: 1200, crop: [790, 190, 1034, 580],
    caption: ["03", "Copy the Playwright suite", "6 page objects · 30/30 cases covered"],
  },
  receipt: {
    shot: "S", from: 12.6, to: 15.6, hold: 1.4, fps: 20, width: 852, crop: [90, 530, 710, 540],
    caption: ["04", "See what it saved, and what it sent", "0 outbound packets"],
  },
  workflow: { shot: "W", from: 0.2, to: 2.6, hold: 0.6, fps: 15, width: 720, crop: [0, 0, 1920, 1080] },
  metrics: { shot: "M", from: 0.15, to: 1.9, hold: 1.8, fps: 15, width: 720, crop: [0, 0, 1920, 1080] },
};
const SCREENS = { "screen-landing": "landing-hero.png", "screen-workflow": "landing-workflow.png", "screen-studio": "studio-revamp.png" };
const ITEMS = [...Object.keys(CLIPS), "title", "screens"];

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${DISPLAY_CSS}">
<style>
@font-face { font-family: "Inter"; font-weight: 100 900; src: url("/inter/inter-latin-wght-normal.woff2") format("woff2"); }
@font-face { font-family: "Geist Pixel Circle"; src: url("/app-assets/fonts/GeistPixel-Circle.woff2") format("woff2"); }
html, body { margin: 0; background: transparent; }
</style></head><body><canvas id="c"></canvas></body></html>`;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}
const ffmpeg = (args) => run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args]);

async function openPage(browser, scale = 1) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: scale });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.route(`${ORIGIN}/**`, (route) => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p === "/") return route.fulfill({ body: PAGE, contentType: "text/html" });
    const dirs = { "/shots/": SHOTS, "/app-assets/": path.join(root, "src", "assets"), "/inter/": path.join(here, "node_modules", "@fontsource-variable", "inter", "files") };
    for (const [prefix, dir] of Object.entries(dirs)) if (p.startsWith(prefix)) return route.fulfill({ path: path.join(dir, p.slice(prefix.length)) });
    return route.fulfill({ status: 404 });
  });
  await page.goto(`${ORIGIN}/`);
  const face = await page.evaluate(async () => {
    await Promise.all([window.document.fonts.load('40px "BubbledotICG-FinePos"'), window.document.fonts.load('40px "Geist Pixel Circle"'), window.document.fonts.load('600 20px "Inter"')]);
    return window.document.fonts.check('40px "BubbledotICG-FinePos"') ? "BubbledotICG-FinePos" : "Geist Pixel Circle";
  });
  if (face !== "BubbledotICG-FinePos") console.warn(`display face unavailable, captions fall back to ${face}`);
  await page.evaluate(installDrawing, face);
  return page;
}

/** In the page: window.drawFrame(spec) paints one card and returns it as a PNG data URL. */
function installDrawing(face) {
  const canvas = window.document.getElementById("c");
  const g = canvas.getContext("2d");
  const DISPLAY = `"${face}", "Geist Pixel Circle", monospace`;
  const roundRect = (x, y, w, h, r) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };
  const expoOut = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));

  function drawCursor(c, ox, oy, s) {
    const x = (c.x - ox) * s;
    const y = (c.y - oy) * s;
    const k = Math.min(1, Math.max(0.6, s)) * 1.1;
    const r = (c.pressed ? 6.5 : 9.5) * c.appear * k;
    if (c.pressAge < 0.5) {
      const u = c.pressAge / 0.5;
      g.beginPath();
      g.arc(x, y, r + 46 * k * expoOut(u), 0, Math.PI * 2);
      g.strokeStyle = `rgba(52, 211, 153, ${0.55 * (1 - u)})`;
      g.lineWidth = 2.5 * k;
      g.stroke();
    }
    g.save();
    g.shadowColor = "rgba(0, 0, 0, 0.55)";
    g.shadowBlur = 10 * k;
    g.shadowOffsetY = 2 * k;
    g.beginPath();
    g.arc(x, y, r + 3 * k, 0, Math.PI * 2);
    g.fillStyle = "rgba(16, 185, 129, 0.62)";
    g.fill();
    g.restore();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = "rgba(255, 255, 255, 0.95)";
    g.fill();
  }

  /** The landing page's step cards, as a strip: glowing numeral, title, mono meta on the right. */
  function drawCaption([num, title, meta], top, W, H) {
    const k = W / 1200;
    g.fillStyle = "#070b11";
    g.fillRect(0, top, W, H);
    g.fillStyle = "rgba(52, 211, 153, 0.22)";
    g.fillRect(0, top, W, Math.max(1, k));
    const mid = top + H / 2;
    const pad = 26 * k;
    g.textBaseline = "middle";
    g.save();
    g.font = `${Math.round(34 * k)}px ${DISPLAY}`;
    const grad = g.createLinearGradient(0, mid - 16 * k, 0, mid + 16 * k);
    grad.addColorStop(0, "#6ee7b7");
    grad.addColorStop(1, "#10b981");
    g.fillStyle = grad;
    g.shadowColor = "rgba(16, 185, 129, 0.65)";
    g.shadowBlur = 14 * k;
    g.fillText(num, pad, mid + 2 * k);
    const numW = g.measureText(num).width;
    g.restore();
    g.font = `600 ${Math.round(21 * k)}px "Inter"`;
    g.fillStyle = "#f0fdf4";
    g.fillText(title, pad + numW + 18 * k, mid + 1);
    g.font = `500 ${Math.round(12.5 * k)}px "SF Mono", Menlo, monospace`;
    g.letterSpacing = `${(1.6 * k).toFixed(2)}px`;
    g.fillStyle = "#64748b";
    g.textAlign = "right";
    const label = meta.toUpperCase();
    g.fillText(label, W - pad, mid + 1);
    const lw = g.measureText(label).width;
    g.beginPath();
    g.arc(W - pad - lw - 12 * k, mid, 3.5 * k, 0, Math.PI * 2);
    g.fillStyle = "#34d399";
    g.shadowColor = "rgba(52, 211, 153, 0.9)";
    g.shadowBlur = 8 * k;
    g.fill();
    g.shadowBlur = 0;
    g.letterSpacing = "0px";
    g.textAlign = "left";
  }

  const cache = new Map();
  async function bitmap(url) {
    if (!cache.has(url)) {
      if (cache.size > 24) cache.delete(cache.keys().next().value);
      cache.set(url, window.fetch(url).then((r) => r.blob()).then((b) => window.createImageBitmap(b)));
    }
    return cache.get(url);
  }

  window.drawFrame = async ({ layers, crop, dsf, W, FH, caption }) => {
    const barH = caption ? Math.round(64 * (W / 1200)) : 0;
    const H = FH + barH;
    const radius = Math.round(14 * Math.max(0.7, W / 1200));
    canvas.width = W;
    canvas.height = H;
    g.clearRect(0, 0, W, H);
    g.save();
    roundRect(0, 0, W, H, radius);
    g.clip();
    g.fillStyle = "#05080c";
    g.fillRect(0, 0, W, H);
    const s = W / crop[2];
    for (const layer of layers) {
      const img = await bitmap(layer.url);
      g.globalAlpha = layer.alpha;
      g.drawImage(img, crop[0] * dsf, crop[1] * dsf, crop[2] * dsf, crop[3] * dsf, 0, 0, W, FH);
      if (layer.cursor) drawCursor(layer.cursor, crop[0], crop[1], s);
    }
    g.globalAlpha = 1;
    if (caption) drawCaption(caption, FH, W, barH);
    g.restore();
    roundRect(0.75, 0.75, W - 1.5, H - 1.5, radius);
    g.strokeStyle = "rgba(52, 211, 153, 0.3)";
    g.lineWidth = 1.5;
    g.stroke();
    return canvas.toDataURL("image/png");
  };
}

/** The reel's cursor state at subframe i: position, press, how long it has been shown and pressed. */
function cursorAt(frames, i) {
  const f = frames[i];
  if (!f?.m) return null;
  let shown = 0;
  for (let k = i; k >= 0 && frames[k].m && shown < SUB_FPS; k--) shown++;
  const u = Math.min(1, shown / (0.3 * SUB_FPS));
  const appear = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2); // ease-out with a slight overshoot
  let pressAge = Infinity;
  for (let k = i; k >= Math.max(0, i - SUB_FPS); k--) {
    if (frames[k].m?.[2] && (k === 0 || !frames[k - 1].m?.[2])) {
      pressAge = (i - k) / SUB_FPS;
      break;
    }
  }
  return { x: f.m[0], y: f.m[1], pressed: f.m[2] === 1, appear, pressAge };
}

async function renderClip(page, id) {
  const c = CLIPS[id];
  const meta = JSON.parse(await fs.readFile(path.join(SHOTS, c.shot, "meta.json"), "utf8"));
  const frames = meta.frames;
  const W = c.width;
  const FH = Math.round((W * c.crop[3]) / c.crop[2] / 2) * 2;
  const layer = (n, alpha) => {
    const i = Math.min(frames.length - 1, Math.round((c.from + n / c.fps) * SUB_FPS));
    return { url: `/shots/${c.shot}/${String(i).padStart(5, "0")}.jpg`, alpha, cursor: cursorAt(frames, i) };
  };
  const N = Math.round((c.to - c.from) * c.fps);
  const L = c.loop ? Math.round(c.loop * c.fps) : 0;
  const plan = [];
  for (let k = 0; k < N - L; k++) {
    const s = k + L;
    const layers = [layer(s, 1)];
    // The tail fades into the head, so the last frame leads straight into the first.
    if (L && s >= N - L) layers.push(layer(s - (N - L), (s - (N - L) + 1) / (L + 1)));
    plan.push(layers);
  }
  for (let h = Math.round((c.hold ?? 0) * c.fps); h > 0; h--) plan.push(plan[plan.length - 1]);

  const dir = path.join(WORK, id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (let k = 0; k < plan.length; k++) {
    const png = await page.evaluate((spec) => window.drawFrame(spec), { layers: plan[k], crop: c.crop, dsf: meta.dsf, W, FH, caption: c.caption ?? null });
    await fs.writeFile(path.join(dir, `${String(k).padStart(4, "0")}.png`), Buffer.from(png.split(",")[1], "base64"));
  }
  const file = path.join(OUT, `${id}.webp`);
  await ffmpeg(["-framerate", String(c.fps), "-i", path.join(dir, "%04d.png"), "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", String(c.quality ?? 88), "-compression_level", "6", "-loop", "0", "-pix_fmt", "yuva420p", file]);
  await fs.rm(dir, { recursive: true, force: true });
  const { size } = await fs.stat(file);
  console.log(`${id}.webp  ${W}×${FH + (c.caption ? Math.round(64 * (W / 1200)) : 0)}  ${plan.length} frames  ${(size / 1048576).toFixed(2)} MB`);
}

/** Wordmark, tagline and subtitle, on a transparent ground in each GitHub theme's colours. */
async function renderTitle(browser, theme) {
  const dark = theme === "dark";
  const ink = dark ? "#f0fdf4" : "#0b1220";
  const muted = dark ? "#94a3b8" : "#475569";
  const accent = dark ? "#34d399" : "#059669";
  const accentDeep = dark ? "#059669" : "#047857";
  const page = await openPage(browser, 2);
  await page.evaluate(
    ({ ink, muted, accent, accentDeep, dark }) => {
      const doc = window.document;
      doc.body.innerHTML = `
      <div id="title" style="width:880px;padding:18px 0 14px;display:flex;flex-direction:column;align-items:center;gap:14px;font-family:Inter">
        <div style="display:flex;align-items:center;gap:16px">
          <svg width="54" height="54" viewBox="0 0 32 32" fill="none">
            <defs><linearGradient id="g" x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="${accent}"/><stop offset="1" stop-color="${accentDeep}"/></linearGradient></defs>
            <path d="M16 2.6 27 7.2v9.6c0 1 -.45 1.95 -1.2 2.6L16 29.4 6.2 19.4A3.5 3.5 0 0 1 5 16.8V7.2L16 2.6Z" fill="url(#g)" fill-opacity="0.16" stroke="url(#g)" stroke-width="1.8" stroke-linejoin="round"/>
            <ellipse cx="16" cy="14.6" rx="3.7" ry="4.5" stroke="url(#g)" stroke-width="1.8"/>
          </svg>
          <span style="font-weight:700;font-size:40px;letter-spacing:0.16em;color:${ink}">SPECSHIELD</span>
          <span style="font:600 17px 'SF Mono',Menlo,monospace;color:${accent};border:1.5px solid ${accent};border-radius:6px;padding:3px 8px;letter-spacing:0.08em">QA</span>
        </div>
        <div style="font-family:'BubbledotICG-FinePos','Geist Pixel Circle',monospace;font-size:44px;line-height:1.1;letter-spacing:0.02em;
          background:linear-gradient(180deg, ${dark ? "#ffffff" : "#0b1220"} 10%, ${accent} 95%);-webkit-background-clip:text;background-clip:text;color:transparent;
          ${dark ? "filter:drop-shadow(0 0 14px rgba(16,185,129,0.35));" : ""}">KEEP THE SPEC. SHIP THE SUITE.</div>
        <div style="font-size:17px;color:${muted};letter-spacing:0.01em">Local-first spec-to-test &amp; Playwright E2E studio
          <span style="color:${accent}">·</span> 100% offline <span style="color:${accent}">·</span> $0.00 token cost</div>
      </div>`;
    },
    { ink, muted, accent, accentDeep, dark },
  );
  const file = path.join(OUT, `title-${theme}.png`);
  await page.locator("#title").screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log(`title-${theme}.png`);
}

async function renderScreens() {
  for (const [id, src] of Object.entries(SCREENS)) {
    const file = path.join(OUT, `${id}.webp`);
    await ffmpeg(["-i", path.join(root, "docs", src), "-vf", "scale=1400:-2:flags=lanczos", "-c:v", "libwebp", "-q:v", "84", "-compression_level", "6", file]);
    console.log(`${id}.webp  ${((await fs.stat(file)).size / 1024).toFixed(0)} KB`);
  }
}

async function main() {
  const asked = process.argv.slice(2);
  const unknown = asked.filter((a) => !ITEMS.includes(a));
  if (unknown.length) throw new Error(`Unknown item(s): ${unknown.join(", ")}. Items: ${ITEMS.join(", ")}`);
  const items = asked.length ? asked : ITEMS;
  if (items.some((i) => CLIPS[i]) && !existsSync(path.join(SHOTS, "S", "meta.json"))) throw new Error("No captured shots: run `node capture.mjs` first.");
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--force-color-profile=srgb"] });
  try {
    const clips = items.filter((i) => CLIPS[i]);
    if (clips.length) {
      const page = await openPage(browser);
      for (const id of clips) await renderClip(page, id);
      await page.close();
    }
    if (items.includes("title")) for (const theme of ["dark", "light"]) await renderTitle(browser, theme);
    if (items.includes("screens")) await renderScreens();
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
