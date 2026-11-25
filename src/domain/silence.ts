import type { SilenceDifficulty, SilenceDurationSec } from './schemas/tables';

/** Meter range shown on screen (SPEC 3.5). */
export const METER_MIN_DB = -70;
export const METER_MAX_DB = -10;
/** Threshold clamp. */
export const THRESHOLD_MIN_DB = -52;
export const THRESHOLD_MAX_DB = -16;
/** ↑ / ↓ step while playing. */
export const THRESHOLD_STEP_DB = 2;
/** Baseline louder than this → "lớp còn hơi ồn" toast. */
export const NOISY_BASELINE_DB = -46;
/** Floor returned for silence (rms 0). */
export const SILENCE_FLOOR_DB = -100;

export const MARGIN_DB: Record<SilenceDifficulty, number> = { easy: 20, medium: 14, hard: 8 };

export const CALIBRATION_SEC = 3;
export const HEARTS = 3;
/** Accumulated over-threshold seconds that cost a heart. */
export const OVER_LIMIT_SEC = 1;
/** Grace period after losing a heart. */
export const GRACE_SEC = 2;
/** Level smoothing time constant (~300 ms). */
export const SMOOTHING_SEC = 0.3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 20·log10(rms), floored at SILENCE_FLOOR_DB. */
export function rmsToDbfs(rms: number): number {
  if (!(rms > 0)) return SILENCE_FLOOR_DB;
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(rms));
}

/** RMS of a time-domain buffer (values in −1…1). */
export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]!;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/** −70 dBFS → 0, −10 dBFS → 1, clamped. */
export function dbfsToMeter(db: number): number {
  if (Number.isNaN(db)) return 0;
  return clamp((db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB), 0, 1);
}

/** Exponential smoothing of a dB level over `dt` seconds (time constant ~300 ms). */
export function smoothDb(prevDb: number, nextDb: number, dt: number, tauSec = SMOOTHING_SEC): number {
  const a = 1 - Math.exp(-Math.max(0, dt) / tauSec);
  return prevDb + (nextDb - prevDb) * a;
}

/** Median; NaN for an empty list. */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** threshold = baseline + margin(difficulty), clamped to [−52, −16] dBFS. */
export function computeThreshold({ baselineDb, difficulty }: { baselineDb: number; difficulty: SilenceDifficulty }): number {
  const base = Number.isFinite(baselineDb) ? baselineDb : METER_MIN_DB;
  return clamp(base + MARGIN_DB[difficulty], THRESHOLD_MIN_DB, THRESHOLD_MAX_DB);
}

export function isNoisyBaseline(baselineDb: number): boolean {
  return baselineDb > NOISY_BASELINE_DB;
}

/** ↑ 'up' loosens (+2 dB), ↓ 'down' tightens (−2 dB); clamped. */
export function nudgeThreshold(db: number, dir: 'up' | 'down'): number {
  return clamp(db + (dir === 'up' ? THRESHOLD_STEP_DB : -THRESHOLD_STEP_DB), THRESHOLD_MIN_DB, THRESHOLD_MAX_DB);
}

// ---------------------------------------------------------------------------
// Heart-loss rule (ported from the mockup's silTick)
// ---------------------------------------------------------------------------

export interface SilenceState {
  hearts: number;
  /** Accumulated over-threshold seconds. */
  overSec: number;
  /** Remaining grace seconds after a heart was lost. */
  graceSec: number;
}

export const initialSilenceState = (): SilenceState => ({ hearts: HEARTS, overSec: 0, graceSec: 0 });

export interface SilenceStepResult {
  state: SilenceState;
  /** Level is above the threshold this frame (meter turns red). */
  over: boolean;
  /** A heart was lost on this step. */
  lostHeart: boolean;
  /** No hearts left (balloon pops). */
  popped: boolean;
}

/**
 * Advance the rule by `dt` seconds. While in grace nothing accumulates; otherwise
 * noise accumulates and > 1 s costs a heart (then 2 s grace); quiet decays the
 * accumulator at 2× speed.
 */
export function silenceStep(state: SilenceState, { dt, levelDb, thresholdDb }: { dt: number; levelDb: number; thresholdDb: number }): SilenceStepResult {
  const over = levelDb > thresholdDb;
  let { hearts, overSec, graceSec } = state;
  let lostHeart = false;
  if (hearts > 0) {
    if (graceSec > 0) {
      graceSec = Math.max(0, graceSec - dt);
    } else if (over) {
      overSec += dt;
      if (overSec > OVER_LIMIT_SEC) {
        hearts -= 1;
        overSec = 0;
        graceSec = GRACE_SEC;
        lostHeart = true;
      }
    } else {
      overSec = Math.max(0, overSec - dt * 2);
    }
  }
  return { state: { hearts, overSec, graceSec }, over, lostHeart, popped: hearts <= 0 };
}

/** Balloon scale grows 75% → 110% over the round. */
export function balloonScale(leftSec: number, durationSec: number): number {
  if (durationSec <= 0) return 1.1;
  return 0.75 + 0.35 * clamp(1 - leftSec / durationSec, 0, 1);
}

const DURATIONS: readonly SilenceDurationSec[] = [30, 60, 120];
const DIFFICULTIES: readonly SilenceDifficulty[] = ['easy', 'medium', 'hard'];

/** "Chơi lại, khó hơn": one step up in both duration and difficulty (capped). */
export function harderSilence({ durationSec, difficulty }: { durationSec: SilenceDurationSec; difficulty: SilenceDifficulty }): {
  durationSec: SilenceDurationSec;
  difficulty: SilenceDifficulty;
} {
  const d = DURATIONS[Math.min(DURATIONS.length - 1, DURATIONS.indexOf(durationSec) + 1)]!;
  const f = DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, DIFFICULTIES.indexOf(difficulty) + 1)]!;
  return { durationSec: d, difficulty: f };
}
