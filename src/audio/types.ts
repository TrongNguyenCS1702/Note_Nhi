/** Music group: `lively` = musical chairs, `calm` = wait screen (SPEC 3.8). */
export type Mood = 'lively' | 'calm';

/** Synthesized sound effects (SPEC 3.8, mockup `Snd.sfx`). */
export type SfxName = 'tada' | 'beep' | 'pop' | 'win' | 'tick' | 'boing' | 'chime';

export const SFX_NAMES: readonly SfxName[] = ['tada', 'beep', 'pop', 'win', 'tick', 'boing', 'chime'];

/** Why the microphone is not usable (SPEC 3.5 "Xử lý lỗi"). */
export type MicErrorKind = 'denied' | 'no-device' | 'ended' | 'unsupported';

export class MicError extends Error {
  readonly kind: MicErrorKind;
  constructor(kind: MicErrorKind, message?: string) {
    super(message ?? `Microphone ${kind}`);
    this.name = 'MicError';
    this.kind = kind;
  }
}

/** A live microphone level meter. Never records or stores audio. */
export interface MicHandle {
  /** Subscribe to smoothed levels in dBFS (≈ every animation frame). Returns unsubscribe. */
  onLevel(cb: (dbfs: number) => void): () => void;
  /** Subscribe to failures while open (e.g. kind 'ended' when the mic is unplugged). Returns unsubscribe. */
  onError(cb: (err: MicError) => void): () => void;
  /** Stops the tracks (mic light turns off) and releases audio nodes. Idempotent. */
  close(): void;
  readonly closed: boolean;
}

/** What actually started: a user track, the synth fallback, or nothing (superseded / no audio). */
export type MusicSource = 'track' | 'synth' | 'none';

export interface StopMusicOptions {
  /** Fade out seconds. 0 / omitted = abrupt cut (musical chairs). Wait screen uses 1.5. */
  fadeSec?: number;
}

/**
 * Everything screens/machines need from the audio layer. Use the real `audio` from
 * `@/audio` in the app and `createFakeAudio()` from `@/audio/fake` in tests.
 */
export interface AudioPort {
  /** Create/resume the AudioContext. Call from a key/click handler (autoplay policy). */
  ensure(): void;
  /** Random track of `mood` from `tracks`, else the generative synth loop. */
  startMusic(mood: Mood, tracks?: readonly Blob[]): Promise<MusicSource>;
  stopMusic(opts?: StopMusicOptions): void;
  sfx(name: SfxName): void;
  /** Slow-down step note `i` (pentatonic, up then down). */
  step(i: number): void;
  /** Suspense drum roll. */
  roll(durationSec: number): void;
  getVolume(): number;
  /** Clamped to 0.1–1; returns the applied value. */
  setVolume(v: number): number;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  /** Rejects with `MicError`. */
  openMic(deviceId?: string): Promise<MicHandle>;
}
