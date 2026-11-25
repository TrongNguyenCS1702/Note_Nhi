// Plays a teacher-provided mp3/m4a Blob through the shared AudioContext (SPEC 3.8).
// - lively (musical chairs): random start offset, abrupt stop with a ~20 ms ramp (no click).
// - calm (wait screen): fade in, loop, fade out.
import { ensureAudio, getMaster, peekAudio } from './context';
import type { Mood } from './types';

export type Rng = () => number;

/** Seconds at the end of a track never used as a random start point. */
export const AVOID_TAIL_SEC = 10;
/** Gain ramp used for an "abrupt" stop so the cut does not click. */
export const CUT_RAMP_SEC = 0.02;

export interface PlayOptions {
  mood?: Mood;
  /** Start at a random offset that is at least `AVOID_TAIL_SEC` before the end. */
  randomStart?: boolean;
  loop?: boolean;
  /** Fade in from silence over this many seconds (0 = start at full gain). */
  fadeInSec?: number;
  rng?: Rng;
}

export interface StopOptions {
  /** Fade out over this many seconds; 0 / omitted = abrupt cut (~20 ms ramp). */
  fadeSec?: number;
}

/**
 * Random start offset in [0, duration - tailSec). Tracks shorter than or equal to the
 * tail (or invalid durations) start at 0.
 */
export function pickStartOffset(durationSec: number, rng: Rng, tailSec: number = AVOID_TAIL_SEC): number {
  if (!Number.isFinite(durationSec) || durationSec <= tailSec) return 0;
  const span = durationSec - tailSec;
  const r = Math.min(Math.max(rng(), 0), 1 - Number.EPSILON);
  return r * span;
}

/** Default play options per mood (SPEC 3.8 / 3.6). */
export function defaultsFor(mood: Mood): Required<Pick<PlayOptions, 'randomStart' | 'loop' | 'fadeInSec'>> {
  return mood === 'lively'
    ? { randomStart: true, loop: true, fadeInSec: 0 }
    : { randomStart: false, loop: true, fadeInSec: 1.5 };
}

// ---------------------------------------------------------------- state

let cache: { blob: Blob; buffer: AudioBuffer } | null = null;
let current: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
/** Bumped by every play/stop so a slow decode cannot start after it was superseded. */
let generation = 0;

async function decode(ctx: AudioContext, blob: Blob): Promise<AudioBuffer> {
  if (cache && cache.blob === blob) return cache.buffer;
  const data = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(data);
  cache = { blob, buffer }; // keep only the most recent buffer (memory on low-end PCs)
  return buffer;
}

export function isTrackPlaying(): boolean {
  return current !== null;
}

/**
 * Decodes (or reuses the cached buffer) and plays `blob`. Resolves `true` once playback
 * has started, `false` if a later `play`/`stop` superseded it. Rejects if Web Audio is
 * unavailable or the file cannot be decoded.
 */
export async function play(blob: Blob, opts: PlayOptions = {}): Promise<boolean> {
  const ctx = ensureAudio(); // synchronous: keeps the user-gesture activation
  const master = getMaster();
  if (!ctx || !master) throw new Error('Web Audio unavailable');
  stopCurrent(ctx, 0);
  const my = ++generation;
  const buffer = await decode(ctx, blob);
  if (my !== generation) return false;

  const base = opts.mood ? defaultsFor(opts.mood) : { randomStart: false, loop: false, fadeInSec: 0 };
  const randomStart = opts.randomStart ?? base.randomStart;
  const loop = opts.loop ?? base.loop;
  const fadeInSec = opts.fadeInSec ?? base.fadeInSec;
  const offset = randomStart ? pickStartOffset(buffer.duration, opts.rng ?? Math.random) : 0;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  const gain = ctx.createGain();
  const t = ctx.currentTime + 0.02;
  if (fadeInSec > 0) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + fadeInSec);
  } else {
    gain.gain.setValueAtTime(1, t);
  }
  src.connect(gain);
  gain.connect(master);
  const entry = { src, gain };
  src.onended = () => {
    if (current === entry) current = null;
    try {
      gain.disconnect();
    } catch {
      // already disconnected
    }
  };
  src.start(t, offset);
  current = entry;
  return true;
}

function stopCurrent(ctx: BaseAudioContext, fadeSec: number): void {
  const c = current;
  current = null;
  if (!c) return;
  const t = ctx.currentTime;
  const g = c.gain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  let end: number;
  if (fadeSec > 0) {
    g.exponentialRampToValueAtTime(0.0001, t + fadeSec);
    end = t + fadeSec + 0.05;
  } else {
    g.linearRampToValueAtTime(0, t + CUT_RAMP_SEC);
    end = t + CUT_RAMP_SEC + 0.005;
  }
  try {
    c.src.stop(end);
  } catch {
    // never started / already stopped
  }
}

/** Stops the current track (and cancels a pending `play`). */
export function stop(opts: StopOptions = {}): void {
  generation++;
  const ctx = peekAudio();
  if (ctx) stopCurrent(ctx, opts.fadeSec ?? 0);
  else current = null;
}

/** Drops the cached decoded buffer (e.g. when the track is deleted). */
export function clearCache(): void {
  cache = null;
}
