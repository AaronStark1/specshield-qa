/* global OfflineAudioContext, btoa -- a browser module, imported by showreel.html */
/**
 * The reel's score, synthesised offline (OfflineAudioContext) so it is identical on every render:
 * 40 s at 120 BPM in A minor (Am F C G, a chord a bar). Sound design is placed on the picture's
 * events: the title, the transitions, the morphs, every click in the studio, the counters, the cut.
 * renderScore() resolves to a base64 16-bit stereo WAV at 48 kHz, normalised to -4 dBFS sample peak.
 */
const SR = 48000;
const LEN = 40;
const BEAT = 0.5;

// Picture events (reel seconds), kept beside the music they drive.
const CLICKS = [8.5, 10.5, 15.5, 17.0, 18.5, 21.0, 22.0, 23.5, 25.0, 26.5, 28.5];
const CHORDS = {
  Am: { root: 55.0, pad: [220.0, 261.63, 329.63], arp: [440.0, 523.25, 659.26, 880.0] },
  F: { root: 43.65, pad: [174.61, 220.0, 261.63], arp: [349.23, 440.0, 523.25, 698.46] },
  C: { root: 65.41, pad: [196.0, 261.63, 329.63], arp: [523.25, 659.26, 783.99, 1046.5] },
  G: { root: 49.0, pad: [196.0, 246.94, 293.66], arp: [392.0, 493.88, 587.33, 783.99] },
};
const PROGRESSION = ["Am", "F", "C", "G"];

export async function renderScore() {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: SR * LEN, sampleRate: SR });
  let seed = 0x2f6b1d;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

  const noise = ctx.createBuffer(2, SR * 3, SR);
  for (let c = 0; c < 2; c++) {
    const d = noise.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  }

  // ── buses ──
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.62, 0);
  master.gain.setValueAtTime(0.62, LEN - 0.35);
  master.gain.linearRampToValueAtTime(0, LEN); // the last hit decays into silence, so the file loops clean
  const soft = ctx.createWaveShaper();
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(1.35 * x) / Math.tanh(1.35);
  }
  soft.curve = curve;
  master.connect(soft).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  const ir = ctx.createBuffer(2, SR * 2.6, SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / d.length, 2.6) * Math.exp(-i / (SR * 0.55));
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  reverb.connect(wet).connect(master);

  const drums = ctx.createGain();
  drums.gain.value = 0.9;
  drums.connect(master);
  const music = ctx.createGain(); // pad, bass and arp: ducked under every kick
  music.connect(master);
  const fx = ctx.createGain();
  fx.gain.value = 0.85;
  fx.connect(master);

  const kickSat = ctx.createWaveShaper();
  const kc = new Float32Array(1024);
  for (let i = 0; i < kc.length; i++) {
    const x = (i / (kc.length - 1)) * 2 - 1;
    kc[i] = Math.tanh(2.2 * x) / Math.tanh(2.2);
  }
  kickSat.curve = kc;
  kickSat.connect(drums);

  // ── voices ──
  const send = (node, amount) => {
    const g = ctx.createGain();
    g.gain.value = amount;
    node.connect(g).connect(reverb);
  };
  const noiseAt = (t, dur, dest) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.connect(dest);
    s.start(t, rnd() * 2, dur);
    return s;
  };
  const filter = (type, f, q = 0.7) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };
  const amp = (t, attack, peak, decay) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, decay);
    return g;
  };

  const kicks = [];
  function kick(t, v = 1, long = false) {
    kicks.push(t);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(long ? 120 : 140, t);
    o.frequency.exponentialRampToValueAtTime(long ? 38 : 48, t + (long ? 0.16 : 0.07));
    o.connect(amp(t, 0.003, 0.95 * v, long ? 0.5 : 0.12)).connect(kickSat);
    o.start(t);
    o.stop(t + (long ? 3 : 0.9));
    const hp = filter("highpass", 3200);
    noiseAt(t, 0.02, hp);
    hp.connect(amp(t, 0.001, 0.09 * v, 0.004)).connect(drums);
  }
  function hat(t, v = 1, open = false) {
    const hp = filter("highpass", 7200);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (rnd() - 0.5) * 0.5;
    noiseAt(t, open ? 0.4 : 0.08, hp);
    hp.connect(amp(t, 0.001, 0.13 * v, open ? 0.12 : 0.028)).connect(pan).connect(drums);
  }
  function clap(t, v = 1) {
    const bp = filter("bandpass", 1350, 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (const [dt, a] of [[0, 0.55], [0.011, 0.45], [0.022, 0.62]]) {
      g.gain.setValueAtTime(a * v * 0.42, t + dt);
      g.gain.setTargetAtTime(0, t + dt + 0.001, 0.006);
    }
    g.gain.setValueAtTime(0.3 * v * 0.42, t + 0.03);
    g.gain.setTargetAtTime(0, t + 0.03, 0.09);
    noiseAt(t, 0.5, bp);
    bp.connect(g).connect(drums);
    send(g, 0.35);
  }
  function bass(t, f, dur, v = 1) {
    const lp = filter("lowpass", 900, 5);
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.setTargetAtTime(230, t, 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.24 * v, t + 0.006);
    g.gain.setTargetAtTime(0.15 * v, t + 0.006, 0.08);
    g.gain.setTargetAtTime(0, t + dur, 0.03);
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    const sub = ctx.createOscillator();
    sub.frequency.value = f;
    sub.connect(g);
    sub.start(t);
    sub.stop(t + dur + 0.3);
    lp.connect(g).connect(music);
  }
  function pad(t0, t1, freqs, v = 1) {
    const lp = filter("lowpass", 1250, 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.045 * v, t0 + 0.35);
    g.gain.setValueAtTime(0.045 * v, t1);
    g.gain.setTargetAtTime(0, t1, 0.22);
    freqs.forEach((f, i) => {
      for (const detune of [-8, 7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = detune + i;
        const p = ctx.createStereoPanner();
        p.pan.value = (detune < 0 ? -0.35 : 0.35) * (i % 2 ? 1 : 0.6);
        o.connect(p).connect(lp);
        o.start(t0);
        o.stop(t1 + 1.4);
      }
    });
    lp.connect(g).connect(music);
    send(g, 0.6);
  }
  const arpDelay = ctx.createDelay(1);
  arpDelay.delayTime.value = BEAT * 0.75;
  const arpFb = ctx.createGain();
  arpFb.gain.value = 0.32;
  const arpLp = filter("lowpass", 2600);
  arpDelay.connect(arpLp).connect(arpFb).connect(arpDelay);
  const arpOut = ctx.createGain();
  arpOut.gain.value = 1;
  arpLp.connect(arpOut);
  arpOut.connect(music);
  function pluck(t, f, v = 1) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = amp(t, 0.002, 0.075 * v, 0.07);
    o.connect(g);
    g.connect(music);
    g.connect(arpDelay);
    o.start(t);
    o.stop(t + 0.6);
  }
  function chime(t, freqs, v = 1) {
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const p = ctx.createStereoPanner();
      p.pan.value = (i % 2 ? 0.3 : -0.25) * (i ? 1 : 0);
      const g = amp(t, 0.004, (0.13 / (1 + i * 0.45)) * v, f > 2500 ? 0.12 : 0.32);
      o.connect(g).connect(p).connect(fx);
      send(g, 0.8);
      o.start(t);
      o.stop(t + 2.4);
    });
  }
  function sweep(t, dur, f0, f1, peak, q = 1.6) {
    const bp = filter("bandpass", f0, q);
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    noiseAt(t, dur + 0.05, bp);
    bp.connect(g).connect(fx);
    send(g, 0.5);
  }
  function riser(t, dur, peak = 0.3) {
    const bp = filter("bandpass", 300, 2.2);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(7500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + dur);
    g.gain.setValueAtTime(0, t + dur + 0.005);
    noiseAt(t, dur + 0.05, bp);
    bp.connect(g).connect(fx);
    send(g, 0.4);
  }
  function impact(t, v = 1, tail = 0.5) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(72, t);
    o.frequency.exponentialRampToValueAtTime(31, t + 0.45);
    o.connect(amp(t, 0.004, 0.75 * v, tail)).connect(kickSat);
    o.start(t);
    o.stop(t + tail * 7);
    const lp = filter("lowpass", 1400);
    noiseAt(t, 0.9, lp);
    const g = amp(t, 0.002, 0.42 * v, 0.16);
    lp.connect(g).connect(fx);
    send(g, 0.9);
  }
  function tick(t, f = 3200, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(amp(t, 0.0008, 0.08 * v, 0.006)).connect(fx);
    o.start(t);
    o.stop(t + 0.06);
    const hp = filter("highpass", 6000);
    noiseAt(t, 0.02, hp);
    hp.connect(amp(t, 0.0005, 0.06 * v, 0.0025)).connect(fx);
  }
  function crackle(t, dur, n, f0, f1, v = 1) {
    for (let i = 0; i < n; i++) {
      const u = rnd();
      tick(t + u * dur, f0 + (f1 - f0) * u + rnd() * 400, (0.55 + rnd() * 0.6) * v);
    }
  }

  // ── arrangement ──
  // Bars 1-2: the hook. An impact, half-time kicks under a drone, a riser into the reveal.
  impact(0, 0.85, 0.6);
  [0, 1, 2, 3].forEach((t) => kick(t, 0.8));
  pad(0, 3.9, [110.0, 164.81], 0.9);
  chime(0.02, [1318.5, 1975.5], 0.55);
  chime(0.52, [1567.98, 2349.3], 0.6);
  for (let i = 0; i < 16; i++) tick(0.95 + i * 0.026, 2400 + i * 60, 0.5);
  crackle(1.3, 0.45, 34, 1800, 5200, 0.8);
  riser(2.75, 1.1, 0.34);

  // Bars 3-17: the groove, a chord a bar from the hero reveal to the end card.
  impact(4.0, 1, 0.55);
  chime(4.02, [880, 1318.5, 1760], 0.9);
  for (let bar = 0; bar < 16; bar++) {
    const t0 = 4 + bar * 2;
    const chord = CHORDS[PROGRESSION[bar % 4]];
    pad(t0, Math.min(t0 + 2, 35), chord.pad, 1);
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT;
      if (t < 35) {
        kick(t);
        hat(t + BEAT / 2, b % 2 ? 0.85 : 1, b === 3 && bar % 4 === 3);
        if (b % 2 === 1) clap(t, 0.9);
      }
      for (let e = 0; e < 2; e++) if (t + e * 0.25 < 35) bass(t + e * 0.25, chord.root * (e && b % 2 ? 2 : 1), 0.19, 0.95);
    }
    // the studio gets a sixteenth-note arpeggio and ghost hats
    if (t0 >= 16 && t0 < 30) {
      for (let s = 0; s < 16; s++) {
        const t = t0 + s * 0.125;
        pluck(t, chord.arp[[0, 1, 2, 3, 2, 1, 2, 3][s % 8]], s % 4 === 0 ? 1 : 0.7);
        if (s % 2 === 1) hat(t, 0.32);
      }
    }
  }

  // Picture events
  sweep(6.3, 1.9, 600, 2400, 0.12); // the cursor stirs the field
  [8.5, 10.5].forEach((t, i) => {
    sweep(t - 0.05, 1.5, 400, 6000, 0.26);
    chime(t + 0.02, i ? [783.99, 1174.66, 1567.98] : [659.26, 987.77, 1318.5], 0.75);
  });
  sweep(12.33, 0.45, 9000, 700, 0.3, 2.2); // scanner beam
  riser(14.95, 0.55, 0.3);
  impact(15.5, 0.9, 0.45); // the shield portal
  chime(15.52, [1046.5, 1567.98, 2093.0], 0.85);
  CLICKS.forEach((t) => tick(t, 3400, 1));
  chime(18.56, [1046.5, 1318.5, 1567.98, 2093.0], 0.8); // run completed
  for (let i = 0; i < 12; i++) pluck(18.56 + i * 0.045, [1046.5, 1318.5, 1567.98, 2093.0][i % 4], 0.9);
  chime(26.56, [1567.98, 2093.0], 0.6); // suite copied
  crackle(30.75, 0.5, 40, 1600, 6000, 0.85); // LED wipe into the counters
  for (let i = 0; i < 26; i++) tick(30.95 + 1.25 * Math.pow(i / 26, 1.7), 2600 + i * 40, 0.55);
  impact(32.25, 0.6, 0.35);
  chime(32.27, [1318.5, 1975.5], 0.6);

  // Bars 18-20: the end card. Drums fall away under the dissolve, the shield forms, the cut lands.
  sweep(34.95, 0.7, 300, 5000, 0.3);
  pad(35, 39.5, [220.0, 261.63, 329.63, 440.0], 1.25);
  bass(35, 55, 2.2, 0.8);
  riser(37.6, 1.9, 0.22);
  chime(37.2, [880, 1318.5, 1760, 2637], 0.7);
  impact(39.5, 1.15, 0.7);
  kick(39.5, 1, true);
  chime(39.52, [440, 659.26, 880, 1318.5], 0.9);

  // sidechain: the music bus dips under every kick
  kicks.sort((a, b) => a - b);
  music.gain.setValueAtTime(1, 0);
  for (const k of kicks) {
    music.gain.setValueAtTime(1, Math.max(0, k - 0.002));
    music.gain.linearRampToValueAtTime(0.5, k + 0.012);
    music.gain.setTargetAtTime(1, k + 0.012, 0.085);
  }

  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  // -4 dBFS sample peak: the clicks and noise bursts overshoot by ~3.5 dB once AAC-encoded.
  const gain = peak > 0 ? 0.631 / peak : 1;
  const frames = L.length, bytes = 44 + frames * 4;
  const dv = new DataView(new ArrayBuffer(bytes));
  const str = (o, s) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  dv.setUint32(4, bytes - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 4, true);
  dv.setUint16(32, 4, true);
  dv.setUint16(34, 16, true);
  str(36, "data");
  dv.setUint32(40, frames * 4, true);
  for (let i = 0, o = 44; i < frames; i++, o += 4) {
    dv.setInt16(o, Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), true);
    dv.setInt16(o + 2, Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), true);
  }
  const u8 = new Uint8Array(dv.buffer);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
