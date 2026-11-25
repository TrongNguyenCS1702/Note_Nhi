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
