// Generative pentatonic music + sound effects, ported 1:1 from the mockup `Snd` module.
// Frequencies, timings and gains must stay identical to the mockup (source of truth for sound).
import { ensureAudio, getMaster, peekAudio } from './context';
import type { Mood, SfxName } from './types';

export type Rng = () => number;

/** Pentatonic scale: C D F G A (two octaves). */
export const SCALE = [261.63, 293.66, 349.23, 392, 440, 523.25, 587.33, 698.46, 783.99, 880] as const;
const BASS = [130.81, 87.31, 98, 130.81] as const;
const MOVES = [-2, -1, -1, 0, 1, 1, 2] as const;

/** A song is a list of scale indices; `null` = rest. */
export type Song = (number | null)[];

// ---------------------------------------------------------------- pure helpers

export function phrase(len: number, start: number, rest: number, rng: Rng): Song {
  const out: Song = [];
  let i = start;
  for (let k = 0; k < len; k++) {
    if (k % 4 !== 0 && rng() < rest) {
      out.push(null);
      continue;
    }
    const move = MOVES[Math.floor(rng() * MOVES.length)] ?? 0;
    i = Math.max(0, Math.min(SCALE.length - 1, i + move));
    out.push(i);
  }
  return out;
}

/** AABA-ish 64-step song; the second A is lifted one scale step in its second half. */
export function makeSong(lively: boolean, rng: Rng): Song {
  const A = phrase(16, lively ? 5 : 4, lively ? 0.12 : 0.35, rng);
  const B = phrase(16, lively ? 6 : 3, lively ? 0.12 : 0.35, rng);
  A[15] = null;
  A[14] = 3;
  B[15] = null;
  B[14] = lively ? 5 : 0;
  return [...A, ...A.map((n, k) => (k < 8 ? n : n == null ? null : Math.min(9, n + 1))), ...B, ...A];
}

/** Scale index for slow-down step `i`: walks up the scale then back down (period 18). */
export function stepIndex(i: number): number {
  const k = ((i % 18) + 18) % 18;
  return k < 10 ? k : 18 - k;
}

/** Loop tempo: seconds per scheduler step. */
export function loopStepSec(mood: Mood): number {
  const lively = mood === 'lively';
  return 60 / (lively ? 140 : 66) / (lively ? 2 : 1);
}

// ---------------------------------------------------------------- voices

interface ToneOpts {
  type?: OscillatorType;
  g?: number;
  dest?: AudioNode;
  glide?: number;
}

let noiseBuf: AudioBuffer | null = null;
let noiseCtx: BaseAudioContext | null = null;

function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (!noiseBuf || noiseCtx !== ctx) {
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = buf;
    noiseCtx = ctx;
  }
  return noiseBuf;
}

function tone(ctx: AudioContext, f: number, t: number, d: number, o: ToneOpts = {}): void {
  const { type = 'triangle', g = 0.18, glide = 0 } = o;
  const dest = o.dest ?? getMaster();
  if (!dest) return;
  const osc = ctx.createOscillator();
  const a = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + d);
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(g, t + 0.012);
  a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  osc.connect(a);
  a.connect(dest);
  osc.start(t);
  osc.stop(t + d + 0.05);
}

interface NoiseOpts {
  g?: number;
  dest?: AudioNode;
  type?: BiquadFilterType;
  freq?: number;
}

function noise(ctx: AudioContext, t: number, d: number, o: NoiseOpts = {}): void {
  const { g = 0.1, type = 'highpass', freq = 7000 } = o;
  const dest = o.dest ?? getMaster();
  if (!dest) return;
  const s = ctx.createBufferSource();
  s.buffer = getNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const a = ctx.createGain();
  a.gain.setValueAtTime(g, t);
  a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f);
  f.connect(a);
  a.connect(dest);
  s.start(t);
  s.stop(t + d + 0.05);
}

// ---------------------------------------------------------------- loops

let loop: { timer: ReturnType<typeof setInterval>; bus: GainNode } | null = null;

export function isLoopPlaying(): boolean {
  return loop !== null;
}

/** Starts the generative background loop (stops any previous one). */
export function startLoop(kind: Mood, rng: Rng = Math.random): void {
  const ctx = ensureAudio();
  const master = getMaster();
  if (!ctx || !master) return;
  stopLoop();
  const lively = kind === 'lively';
  const bus = ctx.createGain();
  bus.connect(master);
  const step = loopStepSec(kind);
  const song = makeSong(lively, rng);
  let i = Math.floor(rng() * 8) * 4;
  let next = ctx.currentTime + 0.06;
  if (!lively) {
    bus.gain.setValueAtTime(0.0001, next);
    bus.gain.exponentialRampToValueAtTime(1, next + 1.5);
  }
  const sched = (): void => {
    while (next < ctx.currentTime + 0.25) {
      const n = song[i % song.length];
      const f = n == null ? undefined : SCALE[n];
      if (lively) {
        if (f !== undefined) {
          tone(ctx, f, next, step * 1.5, { g: 0.15, dest: bus });
          tone(ctx, f * 2, next, step * 0.8, { type: 'sine', g: 0.04, dest: bus });
        }
        if (i % 2 === 0)
          tone(ctx, BASS[Math.floor(i / 8) % 4] ?? BASS[0], next, step * 1.6, { type: 'sine', g: 0.22, dest: bus });
        if (i % 4 === 0) tone(ctx, 150, next, 0.12, { type: 'sine', g: 0.32, dest: bus, glide: 45 });
        if (i % 2 === 1) noise(ctx, next, 0.04, { g: 0.05, dest: bus });
      } else {
        if (f !== undefined) tone(ctx, f, next, step * 1.9, { type: 'sine', g: 0.13, dest: bus });
        if (i % 4 === 0) {
          tone(ctx, 130.81, next, step * 4.3, { type: 'sine', g: 0.07, dest: bus });
          tone(ctx, 196, next, step * 4.3, { type: 'sine', g: 0.04, dest: bus });
        }
      }
      i++;
      next += step;
    }
  };
  sched();
  loop = { timer: setInterval(sched, 40), bus };
}

/** Stops the loop. `fadeSec` > 0 fades out exponentially; 0 cuts immediately (as in the mockup). */
export function stopLoop(fadeSec = 0): void {
  if (!loop) return;
  clearInterval(loop.timer);
  const b = loop.bus;
  loop = null;
  const ctx = peekAudio();
  if (fadeSec > 0 && ctx) {
    const t = ctx.currentTime;
    b.gain.cancelScheduledValues(t);
    b.gain.setValueAtTime(Math.max(0.0001, b.gain.value), t);
    b.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
    setTimeout(() => safeDisconnect(b), fadeSec * 1000 + 150);
  } else {
    safeDisconnect(b);
  }
}

function safeDisconnect(n: AudioNode): void {
  try {
    n.disconnect();
  } catch {
    // already disconnected
  }
}

// ---------------------------------------------------------------- one-shots

export function sfx(name: SfxName): void {
  const ctx = ensureAudio();
  if (!ctx || !getMaster()) return;
  const t = ctx.currentTime + 0.02;
  switch (name) {
    case 'tada':
      [392, 493.88, 587.33, 783.99].forEach((f, k) => tone(ctx, f, t + k * 0.08, 0.5, { g: 0.18 }));
      [523.25, 659.25, 783.99].forEach((f) => tone(ctx, f, t + 0.36, 1.2, { g: 0.11 }));
      break;
    case 'beep':
      tone(ctx, 880, t, 0.14, { type: 'square', g: 0.07 });
      tone(ctx, 660, t + 0.17, 0.22, { type: 'square', g: 0.07 });
      break;
    case 'pop':
      noise(ctx, t, 0.4, { g: 0.6, type: 'lowpass', freq: 1800 });
      tone(ctx, 180, t, 0.3, { type: 'sine', g: 0.4, glide: 45 });
      break;
    case 'win':
      [523.25, 587.33, 698.46, 783.99, 880, 1046.5].forEach((f, k) => tone(ctx, f, t + k * 0.1, 0.4, { g: 0.16 }));
      [523.25, 698.46, 880].forEach((f) => tone(ctx, f, t + 0.65, 1.4, { g: 0.1 }));
      break;
    case 'tick':
      tone(ctx, 1400, t, 0.05, { g: 0.12 });
      break;
    case 'boing':
      tone(ctx, 260, t, 0.4, { type: 'sine', g: 0.26, glide: 720 });
      break;
    case 'chime':
      [880, 1318.5].forEach((f, k) => tone(ctx, f, t + k * 0.25, 1.6, { type: 'sine', g: 0.18 }));
      break;
  }
}

/** One slow-down step: a pentatonic note walking up then down, plus a tiny click. */
export function step(i: number): void {
  const ctx = ensureAudio();
  if (!ctx || !getMaster()) return;
  const t = ctx.currentTime + 0.01;
  tone(ctx, SCALE[stepIndex(i)] ?? SCALE[0], t, 0.32, { g: 0.15 });
  tone(ctx, 2400, t, 0.025, { type: 'square', g: 0.025 });
}

/** Suspense drum roll (crescendo) lasting `durationSec`. */
export function roll(durationSec: number): void {
  const ctx = ensureAudio();
  if (!ctx || !getMaster() || !(durationSec > 0)) return;
  const t0 = ctx.currentTime + 0.01;
  for (let x = 0; x < durationSec; x += 0.045) {
    noise(ctx, t0 + x, 0.04, { g: 0.03 + 0.12 * (x / durationSec), type: 'bandpass', freq: 3000 });
  }
}
