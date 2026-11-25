import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  balloonScale,
  computeThreshold,
  dbfsToMeter,
  harderSilence,
  initialSilenceState,
  isNoisyBaseline,
  median,
  nudgeThreshold,
  rms,
  rmsToDbfs,
  silenceStep,
  smoothDb,
  type SilenceState,
} from './silence';

describe('levels', () => {
  it('rmsToDbfs', () => {
    expect(rmsToDbfs(1)).toBe(0);
    expect(rmsToDbfs(0.1)).toBeCloseTo(-20);
    expect(rmsToDbfs(0)).toBe(-100);
    expect(rmsToDbfs(Number.NaN)).toBe(-100);
  });
  it('rms of a buffer', () => {
    expect(rms([1, -1, 1, -1])).toBe(1);
    expect(rms([])).toBe(0);
  });
  it('dbfsToMeter maps −70→0, −10→1 and clamps', () => {
    expect(dbfsToMeter(-70)).toBe(0);
    expect(dbfsToMeter(-10)).toBe(1);
    expect(dbfsToMeter(-40)).toBeCloseTo(0.5);
    expect(dbfsToMeter(-100)).toBe(0);
    expect(dbfsToMeter(0)).toBe(1);
  });
  it('smoothDb moves toward the target', () => {
    const s = smoothDb(-60, -30, 0.3);
    expect(s).toBeGreaterThan(-60);
    expect(s).toBeLessThan(-30);
    expect(smoothDb(-60, -30, 0)).toBe(-60);
  });
  it('median resists a single spike', () => {
    expect(median([-60, -61, -10, -59, -62])).toBe(-60);
    expect(median([1, 3])).toBe(2);
    expect(median([])).toBeNaN();
  });
});

describe('threshold', () => {
  it('adds margin by difficulty', () => {
    expect(computeThreshold({ baselineDb: -60, difficulty: 'easy' })).toBe(-40);
    expect(computeThreshold({ baselineDb: -60, difficulty: 'medium' })).toBe(-46);
    expect(computeThreshold({ baselineDb: -55, difficulty: 'hard' })).toBe(-47);
  });
  it('clamps to [−52, −16]', () => {
    expect(computeThreshold({ baselineDb: -90, difficulty: 'hard' })).toBe(-52);
    expect(computeThreshold({ baselineDb: -20, difficulty: 'easy' })).toBe(-16);
    expect(computeThreshold({ baselineDb: Number.NaN, difficulty: 'easy' })).toBe(-50);
  });
  it('property: always within clamp', () => {
    fc.assert(
      fc.property(fc.double({ min: -200, max: 50, noNaN: true }), fc.constantFrom('easy', 'medium', 'hard' as const), (b, d) => {
        const t = computeThreshold({ baselineDb: b, difficulty: d });
        expect(t).toBeGreaterThanOrEqual(-52);
        expect(t).toBeLessThanOrEqual(-16);
      }),
    );
  });
  it('noisy baseline and nudging', () => {
    expect(isNoisyBaseline(-45)).toBe(true);
    expect(isNoisyBaseline(-46)).toBe(false);
    expect(nudgeThreshold(-40, 'up')).toBe(-38);
    expect(nudgeThreshold(-40, 'down')).toBe(-42);
    expect(nudgeThreshold(-17, 'up')).toBe(-16);
    expect(nudgeThreshold(-51, 'down')).toBe(-52);
  });
});

describe('silenceStep', () => {
  const run = (s: SilenceState, frames: number, levelDb: number, dt = 0.1) => {
    let lost = 0;
    for (let i = 0; i < frames; i++) {
      const r = silenceStep(s, { dt, levelDb, thresholdDb: -40 });
      s = r.state;
      if (r.lostHeart) lost++;
    }
    return { s, lost };
  };

  it('loses a heart after > 1 s of noise, then 2 s grace', () => {
    let { s, lost } = run(initialSilenceState(), 10, -30);
    expect(lost).toBe(0); // exactly 1.0 s is not > 1
    ({ s, lost } = run(s, 1, -30));
    expect(lost).toBe(1);
    expect(s).toMatchObject({ hearts: 2, overSec: 0, graceSec: 2 });
    ({ s, lost } = run(s, 20, -30)); // grace: nothing accumulates
    expect(lost).toBe(0);
    expect(s.overSec).toBe(0);
    ({ s, lost } = run(s, 11, -30));
    expect(lost).toBe(1);
    expect(s.hearts).toBe(1);
  });

  it('quiet decays the accumulator at 2× speed', () => {
    let { s } = run(initialSilenceState(), 8, -30); // 0.8 s
    ({ s } = run(s, 2, -50)); // −0.4 s
    expect(s.overSec).toBeCloseTo(0.4);
    ({ s } = run(s, 10, -50));
    expect(s.overSec).toBe(0);
  });

  it('pops at zero hearts and stays there', () => {
    let s = initialSilenceState();
    let popped = false;
    for (let i = 0; i < 200 && !popped; i++) {
      const r = silenceStep(s, { dt: 0.1, levelDb: -20, thresholdDb: -40 });
      s = r.state;
      popped = r.popped;
    }
    expect(popped).toBe(true);
    expect(s.hearts).toBe(0);
    const r = silenceStep(s, { dt: 5, levelDb: -20, thresholdDb: -40 });
    expect(r.state.hearts).toBe(0);
    expect(r.lostHeart).toBe(false);
  });

  it('property: hearts never increase and never go negative; at most one heart per step', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ dt: fc.double({ min: 0, max: 0.1, noNaN: true }), levelDb: fc.double({ min: -90, max: 0, noNaN: true }) }), { maxLength: 300 }), (frames) => {
        let s = initialSilenceState();
        for (const f of frames) {
          const r = silenceStep(s, { ...f, thresholdDb: -40 });
          expect(r.state.hearts).toBeLessThanOrEqual(s.hearts);
          expect(s.hearts - r.state.hearts).toBeLessThanOrEqual(1);
          expect(r.state.hearts).toBeGreaterThanOrEqual(0);
          expect(r.state.overSec).toBeGreaterThanOrEqual(0);
          s = r.state;
        }
      }),
    );
  });
});

describe('misc', () => {
  it('balloonScale', () => {
    expect(balloonScale(30, 30)).toBe(0.75);
    expect(balloonScale(0, 30)).toBeCloseTo(1.1);
  });
  it('harderSilence steps both and caps', () => {
    expect(harderSilence({ durationSec: 30, difficulty: 'easy' })).toEqual({ durationSec: 60, difficulty: 'medium' });
    expect(harderSilence({ durationSec: 120, difficulty: 'hard' })).toEqual({ durationSec: 120, difficulty: 'hard' });
  });
});
