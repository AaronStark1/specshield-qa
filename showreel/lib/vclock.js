/**
 * Virtual time for capturing the real app frame by frame. Injected before any page script, it
 * replaces the page's clocks (performance.now, Date, event timestamps) and schedulers (timers,
 * requestAnimationFrame) with ones that only move when the capture calls `__vt.step(ms)`.
 * CSS animations and transitions are pinned to the same clock through the Web Animations API,
 * and <video> elements are paused and seeked to it, so every frame is a pure function of the
 * scripted inputs: re-running a shot reproduces it exactly.
 */
export const VCLOCK_SCRIPT = String.raw`
(() => {
  if (window.__vt) return;
  const EPOCH = Date.UTC(2026, 10, 18, 10, 0, 0);
  const NativeDate = Date;
  const realSetTimeout = window.setTimeout.bind(window);
  let now = 0;
  let seq = 1;
  const timers = new Map();
  const frames = new Map();

  performance.now = () => now;
  function FakeDate(...args) {
    if (!new.target) return new NativeDate(EPOCH + now).toString();
    return args.length ? new NativeDate(...args) : new NativeDate(EPOCH + now);
  }
  FakeDate.prototype = NativeDate.prototype;
  FakeDate.now = () => EPOCH + Math.floor(now);
  FakeDate.parse = NativeDate.parse;
  FakeDate.UTC = NativeDate.UTC;
  window.Date = FakeDate;
  Object.defineProperty(Event.prototype, "timeStamp", { get: () => now, configurable: true });

  const schedule = (fn, ms, args, repeat) => {
    const id = seq++;
    const delay = Math.max(repeat ? 1 : 0, Number(ms) || 0);
    timers.set(id, { id, at: now + delay, every: repeat ? delay : 0, fn, args });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => schedule(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => schedule(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (cb) => {
    const id = seq++;
    frames.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => void frames.delete(id);
  window.requestIdleCallback = (cb) => schedule(() => cb({ didTimeout: false, timeRemaining: () => 40 }), 1, [], false);
  window.cancelIdleCallback = window.clearTimeout;

  const call = (fn, args) => {
    try {
      if (typeof fn === "function") fn(...args);
    } catch (error) {
      console.error(error);
    }
  };

  /** Runs every timer due up to now + ms, in order, then one animation frame at the new time. */
  function advance(ms) {
    const target = now + ms;
    for (let guard = 0; guard < 100000; guard++) {
      let next = null;
      for (const t of timers.values()) if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.every) next.at += next.every;
      else timers.delete(next.id);
      call(next.fn, next.args);
    }
    now = target;
    const due = [...frames.values()];
    frames.clear();
    for (const cb of due) call(cb, [now]);
  }

  // CSS animations and transitions: each is pinned to the virtual time at which it first appeared.
  const born = new WeakMap();
  function pinAnimations() {
    for (const a of document.getAnimations()) {
      let start = born.get(a);
      if (start === undefined) {
        start = now;
        born.set(a, start);
      }
      if (a.playState !== "paused") a.pause();
      const t = now - start;
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      // A finished transition has handed over to the new style; dropping it keeps the list short.
      if (timing && a instanceof CSSTransition && t >= timing.endTime) a.cancel();
      else a.currentTime = t;
    }
  }

  // Videos follow the same clock from the moment they are first seen, snapped to the middle of
  // their own frames (VIDEO_FPS) so a seek only happens when the picture would change.
  const VIDEO_FPS = 24;
  const videoBorn = new WeakMap();
  function pinVideos() {
    const waits = [];
    for (const v of document.querySelectorAll("video")) {
      if (!v.paused) v.pause();
      if (!(v.duration > 0) || v.readyState < 1) continue;
      if (!videoBorn.has(v)) videoBorn.set(v, now);
      const frames = Math.max(1, Math.floor(v.duration * VIDEO_FPS));
      const index = Math.floor(((now - videoBorn.get(v)) / 1000) * VIDEO_FPS) % frames;
      const target = (index + 0.5) / VIDEO_FPS;
      if (Math.abs(v.currentTime - target) < 1e-3 && v.readyState >= 2) continue;
      // "seeked" means the new frame is decoded; requestVideoFrameCallback is unreliable headless.
      waits.push(
        new Promise((resolve) => {
          v.addEventListener("seeked", () => resolve(), { once: true });
          realSetTimeout(resolve, 500);
        }),
      );
      v.currentTime = target;
    }
    return Promise.all(waits);
  }

  window.__vt = {
    get now() {
      return now;
    },
    /** Advances virtual time by ms and settles animations and videos at the new time. */
    async step(ms) {
      advance(ms);
      pinAnimations();
      await pinVideos();
    },
    pinAnimations,
    pinVideos,
  };
})();
`;
