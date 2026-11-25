// Facade used by screens: play a random teacher track of the mood, or fall back to the
// generative synth loop when there is none (or it fails to decode). No DB access here:
// screens pass the Blobs they loaded through repositories.
import { ensureAudio } from './context';
import { startLoop, stopLoop } from './synth';
import * as trackPlayer from './trackPlayer';
import type { Mood } from './types';

export type Rng = () => number;

/** What actually started: a user track, the synth fallback, or nothing (superseded / no audio). */
export type MusicSource = 'track' | 'synth' | 'none';

export interface StopMusicOptions {
  /** Fade out seconds. 0 / omitted = abrupt cut (musical chairs). Wait screen uses 1.5. */
  fadeSec?: number;
}

let generation = 0;

/** Picks a uniformly random element, or undefined for an empty list. */
export function pickRandom<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export async function startMusic(mood: Mood, tracks?: readonly Blob[], rng: Rng = Math.random): Promise<MusicSource> {
  // Must run synchronously inside the user gesture so the context can resume.
  if (!ensureAudio()) return 'none';
  const my = ++generation;
  stopLoop();
  trackPlayer.stop();
  const blob = pickRandom(tracks ?? [], rng);
  if (blob) {
    try {
      const started = await trackPlayer.play(blob, { mood, rng });
      if (started) return 'track';
      return 'none';
    } catch {
      // undecodable file: fall back to the synth below
    }
    if (my !== generation) return 'none';
  }
  startLoop(mood, rng);
  return 'synth';
}

export function stopMusic(opts: StopMusicOptions = {}): void {
  generation++;
  const fadeSec = opts.fadeSec ?? 0;
  trackPlayer.stop({ fadeSec });
  stopLoop(fadeSec);
}
