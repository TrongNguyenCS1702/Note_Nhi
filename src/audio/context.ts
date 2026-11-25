// Shared AudioContext + master gain (port of mockup `Snd.ensure`, `setVol`, `setMuted`).
// The context is created lazily; browsers only let it run after a user gesture,
// so screens should call `ensureAudio()` from a key/click handler.

export const DEFAULT_VOLUME = 0.7;
export const MIN_VOLUME = 0.1;
export const MAX_VOLUME = 1;

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = DEFAULT_VOLUME;
let muted = false;

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOLUME;
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, v));
}

function getCtor(): AudioContextCtor | undefined {
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext;
}

/** Creates (once) and resumes the shared AudioContext. Returns null when Web Audio is unavailable. */
export function ensureAudio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = getCtor();
      if (!AC) return null;
      const c = new AC();
      const g = c.createGain();
      g.gain.value = muted ? 0 : volume;
      g.connect(c.destination);
      ctx = c;
      master = g;
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** The context if it already exists (never creates one). */
export function peekAudio(): AudioContext | null {
  return ctx;
}

/** Master gain node; only valid after a successful `ensureAudio()`. */
export function getMaster(): GainNode | null {
  return master;
}

export function getVolume(): number {
  return volume;
}

/** Sets master volume (clamped to 0.1–1). Returns the applied value. */
export function setVolume(v: number): number {
  volume = clampVolume(v);
  if (master && !muted) master.gain.value = volume;
  return volume;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (master) master.gain.value = m ? 0 : volume;
}
