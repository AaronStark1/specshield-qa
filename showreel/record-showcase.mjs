#!/usr/bin/env node
/**
 * Records the four looping clips for the landing page's showcase section from the real studio.
 *
 *   # terminal 1: the app, with the offline engine and no outbound tracing
 *   FORCE_FALLBACK=true SENTRY_DSN= npm run dev
 *   # terminal 2
 *   cd showreel && npm run showcase                      # → ../public/media/<clip>.mp4 + .jpg
 *   BASE=http://localhost:5175 npm run showcase          # when the web server is on another port
 *   node record-showcase.mjs privacy-audit               # a single clip
 *
 * Each clip drives the studio in headless Chromium, captures the DevTools screencast (frames are
 * emitted only when the page changes, so holds cost nothing) and encodes it with ffmpeg. The run
 * aborts if the studio requests anything from a host other than BASE, which is what lets the
 * "Local Privacy Audit" clip say it was recorded with zero outbound traffic.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";

const here = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.join(here, "out", "showcase");
const mediaDir = path.resolve(here, "..", "public", "media");
const BASE = process.env.BASE ?? "http://localhost:5173";
const VIEWPORT = { width: 880, height: 550 };
const SCALE = 2;
const OUTPUT = { width: 1280, height: 800 };
const FPS = 30;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A visible pointer, since headless Chromium draws none. Lives only in the recording. */
const CURSOR_SCRIPT = `
  window.addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;" +
      "background:rgba(255,255,255,.92);box-shadow:0 0 0 3px rgba(16,185,129,.55),0 2px 10px rgba(0,0,0,.6);" +
      "z-index:2147483647;pointer-events:none;transform:translate(-40px,-40px);transition:width .12s,height .12s,margin .12s";
    document.body.appendChild(dot);
    window.addEventListener("mousemove", (e) => { dot.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, true);
    window.addEventListener("mousedown", () => { dot.style.width = dot.style.height = "12px"; dot.style.margin = "-6px 0 0 -6px"; }, true);
    window.addEventListener("mouseup", () => { dot.style.width = dot.style.height = "18px"; dot.style.margin = "-9px 0 0 -9px"; }, true);
  });
`;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited ${code}\n${stderr.slice(-1200)}`))));
  });
}

/** Moves the pointer to the element's centre along a short eased path, then clicks. */
async function click(page, locator, { settle = 450 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element to click is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
  await pause(140);
  await page.mouse.down();
  await pause(70);
  await page.mouse.up();
  await pause(settle);
}

async function scrollTo(page, locator, offset = 76) {
  await locator.evaluate((el, top) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - top, behavior: "smooth" }), offset);
  await pause(750);
}

const generateButton = (page) => page.getByRole("button", { name: "Generate test suite" });

/** Opens the studio with the Invoice Tracker sample already generated. */
async function withGeneratedSuite(page) {
  await page.goto(`${BASE}/studio?sample=invoice-tracker`);
  await generateButton(page).click();
  await page.getByText(/Completed in/).waitFor();
  await pause(400);
}

const CLIPS = {
  "spec-parsing": {
    async prepare(page) {
      await page.goto(`${BASE}/studio`);
      await pause(500);
    },
    async perform(page) {
      await pause(700);
      await click(page, page.getByRole("button", { name: "Invoice Tracker" }), { settle: 1300 });
      await click(page, generateButton(page), { settle: 500 });
      await scrollTo(page, page.getByRole("region", { name: "Run progress" }));
      await pause(1500);
      await click(page, page.locator("tbody tr").nth(1), { settle: 2200 });
    },
  },
  "matrix-filtering": {
    async prepare(page) {
      await withGeneratedSuite(page);
      await scrollTo(page, page.getByRole("tablist", { name: "Output" }), 70);
    },
    async perform(page) {
      await pause(600);
      const matrix = page.locator("#panel-matrix");
      await click(page, matrix.getByRole("button", { name: /^Boundary/ }), { settle: 1000 });
      await click(page, matrix.getByRole("button", { name: /^Security/ }), { settle: 1000 });
      await click(page, matrix.getByRole("button", { name: /^P0/ }), { settle: 900 });
      const search = page.getByPlaceholder("Search test cases…");
      await click(page, search, { settle: 200 });
      await search.pressSequentially("token", { delay: 110 });
      await pause(700);
      await click(page, page.locator("tbody tr").first(), { settle: 2400 });
    },
  },
  "playwright-export": {
    async prepare(page) {
      await withGeneratedSuite(page);
      await scrollTo(page, page.getByRole("tablist", { name: "Output" }), 70);
    },
    async perform(page) {
      await pause(600);
      await click(page, page.getByRole("tab", { name: /Playwright Code/ }), { settle: 1200 });
      await click(page, page.getByRole("tab", { name: /login\.page\.ts/ }), { settle: 1300 });
      await click(page, page.getByRole("button", { name: "Copy Suite" }), { settle: 1300 });
      await click(page, page.getByRole("button", { name: "Download .zip" }), { settle: 2200 });
    },
  },
  "privacy-audit": {
    async prepare(page) {
      await page.goto(`${BASE}/studio?sample=checkout`);
      await pause(400);
      await scrollTo(page, page.getByPlaceholder("e.g. Invoice Tracker v1.0"), 40);
    },
    async perform(page) {
      await pause(800);
      await click(page, generateButton(page), { settle: 1500 });
      const privacy = page.getByRole("region", { name: "Privacy" });
      const box = await privacy.boundingBox();
      if (box) await page.mouse.move(box.x + box.width * 0.09, box.y + box.height * 0.6, { steps: 26 });
      await pause(1600);
      if (box) await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.6, { steps: 22 });
      await pause(2600);
    },
  },
};

async function record(browser, id) {
  const clip = CLIPS[id];
  const frameDir = path.join(workDir, id);
  await fs.rm(frameDir, { recursive: true, force: true });
  await fs.mkdir(frameDir, { recursive: true });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript(CURSOR_SCRIPT);
  const page = await context.newPage();
  const baseHost = new URL(BASE).host;
  const external = new Set();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.host !== baseHost) external.add(url.host);
  });

  await clip.prepare(page);

  const cdp = await context.newCDPSession(page);
  const frames = [];
  const writes = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = path.join(frameDir, `${String(frames.length).padStart(5, "0")}.jpg`);
    frames.push({ file, time: metadata.timestamp });
    writes.push(fs.writeFile(file, Buffer.from(data, "base64")));
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
  const startedAt = Date.now();
  await clip.perform(page);
  const lengthSeconds = (Date.now() - startedAt) / 1000;
  await cdp.send("Page.stopScreencast");
  await Promise.all(writes);
  await context.close();

  if (external.size > 0) throw new Error(`${id}: the studio contacted ${[...external].join(", ")} while recording`);
  if (frames.length < 2) throw new Error(`${id}: the screencast produced no frames`);

  // Frames arrive only when the page changes; the concat list gives each one its on-screen duration.
  const first = frames[0].time;
  const list = [];
  frames.forEach((frame, i) => {
    const end = i + 1 < frames.length ? frames[i + 1].time : first + lengthSeconds;
    list.push(`file '${frame.file}'`, `duration ${Math.max(1 / 120, end - frame.time).toFixed(4)}`);
  });
  list.push(`file '${frames[frames.length - 1].file}'`);
  const listFile = path.join(frameDir, "frames.txt");
  await fs.writeFile(listFile, list.join("\n"));

  const video = path.join(mediaDir, `${id}.mp4`);
  const filter = `fps=${FPS},scale=${OUTPUT.width}:${OUTPUT.height}:flags=lanczos,format=yuv420p`;
  await run(ffmpegPath, [
    "-y", "-f", "concat", "-safe", "0", "-i", listFile,
    "-vf", filter, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-movflags", "+faststart", video,
  ]);
  // Poster: the last frame, where the clip's result is on screen.
  await run(ffmpegPath, [
    "-y", "-i", frames[frames.length - 1].file,
    "-vf", `scale=${OUTPUT.width}:${OUTPUT.height}:flags=lanczos`, "-q:v", "4", path.join(mediaDir, `${id}.jpg`),
  ]);
  const { size } = await fs.stat(video);
  console.log(`${id}: ${lengthSeconds.toFixed(1)} s, ${frames.length} frames, ${(size / 1024).toFixed(0)} KB, no external requests`);
}

const requested = process.argv.slice(2);
const ids = requested.length > 0 ? requested : Object.keys(CLIPS);
for (const id of ids) if (!CLIPS[id]) throw new Error(`Unknown clip "${id}". Available: ${Object.keys(CLIPS).join(", ")}`);

await fs.mkdir(mediaDir, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  for (const id of ids) await record(browser, id);
} finally {
  await browser.close();
}
