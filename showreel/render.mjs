#!/usr/bin/env node
/**
 * Renders the 40-second SpecShield QA reel (showreel.html) to ../docs/specshield-showreel.mp4.
 *
 *   npm install                          # once, inside showreel/
 *   node capture.mjs                     # film the shots from the running app (see capture.mjs)
 *   npm run render                       # compose 2,400 frames, render the score, encode
 *   npm run beats                        # review: one frame per beat (80) on a contact sheet
 *   node render.mjs --at 4.5,18.6        # review: single frames at these seconds
 *   node render.mjs --range 15,17,0.1    # review: a strip of frames as a contact sheet
 *   npm run audio                        # the score only
 *   node render.mjs --encode             # re-encode the last render's frames and WAV
 *
 * Writes the master (1080p60) and a web cut under 10 MB (720p30, for GitHub README uploads) beside it.
 * Each output frame averages three captured subframes (motion blur) inside the page's WebGL
 * compositor; frames are written as JPEG, then muxed with the WAV the page renders offline.
 */
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";

const here = path.dirname(fileURLToPath(import.meta.url));
const appAssets = path.resolve(here, "..", "src", "assets");
const outDir = path.join(here, "out");
const target = path.resolve(here, "..", "docs", "specshield-showreel.mp4");
const webTarget = target.replace(/\.mp4$/, "-web.mp4");
/** GitHub's README attachment limit is 10 MB on free plans; leave headroom for the container. */
const WEB_BYTES = 9.4 * 1024 * 1024;
const FPS = 60;
const W = 1920, H = 1080;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

/** Serves showreel/ (page, score, fonts, captured shots) and the app's bundled fonts. */
function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const [base, rel] = url.startsWith("/app-assets/") ? [appAssets, url.slice("/app-assets".length)] : [here, url === "/" ? "/showreel.html" : url];
    const file = path.join(base, rel);
    if (!file.startsWith(base + path.sep) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function openPages(count, url) {
  const browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--force-color-profile=srgb", "--hide-scrollbars"],
  });
  const pages = await Promise.all(
    [...Array(count)].map(async () => {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => console.error("page error:", e.message));
      page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
      await page.goto(url, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 120000 });
      const err = await page.evaluate(() => window.__error);
      if (err) throw new Error(err);
      return page;
    }),
  );
  const face = await pages[0].evaluate(() => window.displayFace);
  if (face !== "BubbledotICG-FinePos") console.warn(`display face unavailable, titles fall back to ${face}`);
  return { browser, pages };
}

async function frame(page, k, file) {
  await page.evaluate((i) => window.renderFrame(i), k);
  await page.screenshot({ path: file, type: "jpeg", quality: 97 });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}
const ffmpeg = (args) => run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
/** JPEG frames are full-range BT.601; browsers expect tagged BT.709 for HD, or colours shift. */
const TO_709 = "scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv";
const TAG_709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

async function renderAudio(page) {
  const b64 = await page.evaluate(() => window.renderAudio());
  const file = path.join(outDir, "specshield-showreel.wav");
  await fs.writeFile(file, Buffer.from(b64, "base64"));
  return file;
}

/** Frames at the given times, tiled into one contact sheet. */
async function sheet(page, times, name, cols = 5) {
  const dir = path.join(outDir, "review", name);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (let i = 0; i < times.length; i++) await frame(page, Math.round(times[i] * FPS), path.join(dir, `${String(i).padStart(3, "0")}.jpg`));
  const rows = Math.ceil(times.length / cols);
  const file = path.join(outDir, "review", `${name}.jpg`);
  await ffmpeg(["-framerate", "1", "-i", path.join(dir, "%03d.jpg"), "-vf", `scale=480:270,tile=${cols}x${rows}:padding=6:margin=6:color=0x222222`, "-frames:v", "1", file]);
  return file;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const value = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  await fs.mkdir(path.join(outDir, "review"), { recursive: true });
  if (!existsSync(path.join(outDir, "shots", "S", "meta.json"))) throw new Error("No captured shots: run `node capture.mjs` first.");

  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/showreel.html`;
  const review = flag("--beats") || value("--at") || value("--range") || flag("--audio") || flag("--encode");
  const workers = review ? 1 : Math.max(2, Math.min(6, os.cpus().length - 4));
  const { browser, pages } = await openPages(workers, url);
  try {
    if (flag("--audio")) return console.log("audio:", await renderAudio(pages[0]));
    if (value("--at")) {
      for (const t of value("--at").split(",").map(Number)) {
        const file = path.join(outDir, "review", `frame-${t.toFixed(2)}.jpg`);
        await frame(pages[0], Math.round(t * FPS), file);
        console.log(file);
      }
      return;
    }
    if (value("--range")) {
      const [a, b, step] = value("--range").split(",").map(Number);
      const times = [];
      for (let t = a; t <= b + 1e-9; t += step) times.push(Math.round(t * 1000) / 1000);
      return console.log("range sheet:", await sheet(pages[0], times, `range-${a}-${b}`, Number(value("--cols") ?? 5)));
    }
    if (flag("--beats")) {
      const offset = Number(value("--offset") ?? 0.25);
      const times = [...Array(80)].map((_, i) => i * 0.5 + offset);
      return console.log("beats sheet:", await sheet(pages[0], times, "beats", 8));
    }

    // Full render (or, with --encode, just the encode of the last render)
    const frames = path.join(outDir, "frames");
    const started = Date.now();
    let wav = path.join(outDir, "specshield-showreel.wav");
    if (!flag("--encode")) {
      await fs.rm(frames, { recursive: true, force: true });
      await fs.mkdir(frames, { recursive: true });
      const total = await pages[0].evaluate(() => window.FRAMES);
      let next = 0, done = 0;
      await Promise.all(
        pages.map(async (page) => {
          for (let k = next++; k < total; k = next++) {
            await frame(page, k, path.join(frames, `${String(k).padStart(5, "0")}.jpg`));
            if (++done % 240 === 0) console.log(`  ${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
          }
        }),
      );
      wav = await renderAudio(pages[0]);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await ffmpeg([
      "-framerate", String(FPS),
      "-i", path.join(frames, "%05d.jpg"),
      "-i", wav,
      "-map", "0:v",
      "-map", "1:a",
      "-vf", `${TO_709},format=yuv420p`,
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", value("--crf") ?? "22",
      "-profile:v", "high",
      "-level", "4.2",
      "-g", "120",
      ...TAG_709,
      "-c:a", "aac",
      "-b:a", "192k",
      "-t", "40",
      "-movflags", "+faststart",
      target,
    ]);
    const { size } = await fs.stat(target);
    console.log(`video: ${target} (${(size / 1048576).toFixed(2)} MB, ${((Date.now() - started) / 1000).toFixed(0)}s)`);

    // Web cut: 720p30, two-pass to a bitrate that lands under the README upload limit.
    const audioKbps = 96;
    const videoKbps = Math.floor((WEB_BYTES * 8) / 40 / 1000 - audioKbps - 40);
    const webIn = ["-framerate", String(FPS), "-i", path.join(frames, "%05d.jpg")];
    const webOut = ["-vf", `fps=30,scale=1280:720:flags=lanczos,${TO_709},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-b:v", `${videoKbps}k`, "-profile:v", "high", "-g", "60", ...TAG_709];
    const passlog = path.join(outDir, "web-pass");
    await ffmpeg([...webIn, ...webOut, "-pass", "1", "-passlogfile", passlog, "-an", "-t", "40", "-f", "mp4", os.devNull]);
    await ffmpeg([...webIn, "-i", wav, ...webOut, "-map", "0:v", "-map", "1:a", "-pass", "2", "-passlogfile", passlog, "-c:a", "aac", "-b:a", `${audioKbps}k`, "-t", "40", "-movflags", "+faststart", webTarget]);
    const webSize = (await fs.stat(webTarget)).size;
    console.log(`web cut: ${webTarget} (${(webSize / 1048576).toFixed(2)} MB)`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
