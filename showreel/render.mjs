#!/usr/bin/env node
/**
 * Renders the 15-second SpecShield QA showreel (showreel.html) to ../docs/specshield-showreel.mp4.
 *
 *   npm install                          # once, inside showreel/
 *   npm run render                       # full render: 900 frames x 3 subframes, tmix, mux
 *   npm run beats                        # pre-flight: one frame per beat (t = 0.0, 0.5 ... 14.5) + contact sheet
 *   node render.mjs --beats --offset .25 # the same, a quarter beat later
 *   node render.mjs --at 2.5,10.62       # single frames at the given seconds
 *   node render.mjs --range 9,10,0.05    # a strip of frames from 9 s to 10 s, as a contact sheet
 *   npm run audio                        # the soundtrack only
 *   npm run preview                      # serve http://127.0.0.1:4173/showreel.html?scrub
 *
 * Frames come from Playwright's Chromium: window.seek(t) renders second t, each frame is shot as
 * three PNG subframes (t - 5.5 ms, t, t + 5.5 ms) that ffmpeg's tmix blends into motion blur, then
 * the frames are muxed with the WAV the page renders through OfflineAudioContext.
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
const outDir = path.join(here, "out");
const target = path.resolve(here, "..", "docs", "specshield-showreel.mp4");
const PAGE = "showreel.html";
const FPS = 60,
  DUR = 15,
  SUB = 3,
  SUB_DT = 0.0055,
  W = 1920,
  H = 1080;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".woff2": "font/woff2",
  ".js": "text/javascript",
  ".css": "text/css",
};

/** Serves showreel/ (the page and the Inter font from node_modules) on 127.0.0.1. */
function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.join(here, url === "/" ? PAGE : url);
    if (!file.startsWith(here + path.sep) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function openPages(count, url) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--force-color-profile=srgb", "--hide-scrollbars", "--font-render-hinting=none", "--disable-lcd-text"],
  });
  const pages = await Promise.all(
    [...Array(count)].map(async () => {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => console.error("page error:", e.message));
      page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
      await page.goto(url, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
      return page;
    })
  );
  return { browser, pages };
}

async function shot(page, t, file) {
  await page.evaluate((tt) => window.seek(tt), t);
  await page.screenshot({ path: file, type: "png", caret: "hide" });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}
const ffmpeg = (args) => run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args]);

async function renderAudio(page) {
  const b64 = await page.evaluate(() => window.renderAudio());
  const file = path.join(outDir, "specshield-showreel.wav");
  await fs.writeFile(file, Buffer.from(b64, "base64"));
  return file;
}

/** Renders frames at the given times into dir and tiles them into one contact sheet. */
async function sheet(page, times, dir, sheetFile, cols = 5) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (let i = 0; i < times.length; i++) {
    await shot(page, times[i], path.join(dir, `${String(i + 1).padStart(3, "0")}-t${times[i].toFixed(2)}.png`));
  }
  // ffmpeg's image2 pattern needs plain sequential names; tile from symlink-free copies
  const seq = path.join(dir, "seq");
  await fs.mkdir(seq, { recursive: true });
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".png")).sort();
  await Promise.all(files.map((f, i) => fs.copyFile(path.join(dir, f), path.join(seq, `${String(i + 1).padStart(3, "0")}.png`))));
  const rows = Math.ceil(times.length / cols);
  await ffmpeg([
    "-framerate", "1",
    "-i", path.join(seq, "%03d.png"),
    "-vf", `scale=640:360,tile=${cols}x${rows}:padding=8:margin=8:color=0x222222`,
    "-frames:v", "1",
    sheetFile,
  ]);
  await fs.rm(seq, { recursive: true, force: true });
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const value = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  await fs.mkdir(outDir, { recursive: true });

  if (flag("--preview")) {
    await serve(4173);
    console.log(`Scrub the reel at http://127.0.0.1:4173/${PAGE}?scrub`);
    return new Promise(() => {});
  }

  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/${PAGE}`;
  const review = flag("--beats") || value("--at") || value("--range") || flag("--audio");
  const workers = review ? 1 : Math.max(2, Math.min(8, os.cpus().length - 2));
  const { browser, pages } = await openPages(workers, url);
  try {
    if (flag("--audio")) {
      console.log("audio:", await renderAudio(pages[0]));
      return;
    }

    if (value("--at")) {
      for (const t of value("--at").split(",").map(Number)) {
        const file = path.join(outDir, `frame-${t.toFixed(3)}.png`);
        await shot(pages[0], t, file);
        console.log(file);
      }
      return;
    }

    if (value("--range")) {
      const [a, b, step] = value("--range").split(",").map(Number);
      const times = [];
      for (let t = a; t <= b + 1e-9; t += step) times.push(Math.round(t * 1000) / 1000);
      const file = path.join(outDir, `range-${a}-${b}.jpg`);
      await sheet(pages[0], times, path.join(outDir, "range"), file, Number(value("--cols") ?? 5));
      console.log("range sheet:", file);
      return;
    }

    if (flag("--beats")) {
      const offset = Number(value("--offset") ?? 0);
      const times = [...Array(DUR * 2)].map((_, i) => i * 0.5 + offset);
      const file = path.join(outDir, `beats-sheet${offset ? "-" + offset : ""}.jpg`);
      await sheet(pages[0], times, path.join(outDir, "beats"), file);
      console.log("beats:", path.join(outDir, "beats"), "\nsheet:", file);
      return;
    }

    // Full render: 60 fps x 3 subframes centred on each frame's time.
    const frames = path.join(outDir, "frames");
    await fs.rm(frames, { recursive: true, force: true });
    await fs.mkdir(frames, { recursive: true });
    const total = FPS * DUR * SUB;
    const timeOf = (i) => Math.max(0, Math.floor(i / SUB) / FPS + ((i % SUB) - (SUB - 1) / 2) * SUB_DT);
    let next = 0,
      done = 0;
    const started = Date.now();
    await Promise.all(
      pages.map(async (page) => {
        for (let i = next++; i < total; i = next++) {
          await shot(page, timeOf(i), path.join(frames, `${String(i).padStart(5, "0")}.png`));
          if (++done % 270 === 0) console.log(`  ${done}/${total} subframes, ${((Date.now() - started) / 1000).toFixed(0)}s`);
        }
      })
    );
    const wav = await renderAudio(pages[0]);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // tmix averages each run of three subframes; select keeps the frame that closes each run.
    await ffmpeg([
      "-framerate", String(FPS * SUB),
      "-i", path.join(frames, "%05d.png"),
      "-i", wav,
      "-filter_complex",
      `[0:v]tmix=frames=${SUB}:weights='1 1 1',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),` +
        "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p[v]",
      "-map", "[v]",
      "-map", "1:a",
      "-r", String(FPS),
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", value("--crf") ?? "18",
      "-profile:v", "high",
      "-level", "4.2",
      "-g", "120",
      "-colorspace", "bt709",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-color_range", "tv",
      "-c:a", "aac",
      "-b:a", "192k",
      "-t", String(DUR),
      "-movflags", "+faststart",
      target,
    ]);
    const { size } = await fs.stat(target);
    console.log(`video: ${target} (${(size / 1048576).toFixed(2)} MB, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
