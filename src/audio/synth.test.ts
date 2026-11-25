import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clampVolume } from './context';
import { seededRng as seeded } from './seededRng';
import { loopStepSec, makeSong, phrase, SCALE, stepIndex } from './synth';

describe('synth pure helpers', () => {
  it('makeSong is deterministic for the same seed', () => {
    expect(makeSong(true, seeded(42))).toEqual(makeSong(true, seeded(42)));
    expect(makeSong(false, seeded(7))).toEqual(makeSong(false, seeded(7)));
    expect(makeSong(true, seeded(1))).not.toEqual(makeSong(true, seeded(2)));
  });

  it('songs are 64 steps of valid scale indices with fixed cadences', () => {
    fc.assert(
      fc.property(fc.integer(), fc.boolean(), (seed, lively) => {
        const s = makeSong(lively, seeded(seed));
        expect(s).toHaveLength(64);
        for (const n of s) if (n != null) expect(n >= 0 && n < SCALE.length && Number.isInteger(n)).toBe(true);
        // A ends on index 3 then a rest; B ends on 5 (lively) / 0 (calm)
        expect(s[14]).toBe(3);
        expect(s[15]).toBeNull();
        expect(s[46]).toBe(lively ? 5 : 0);
        expect(s[47]).toBeNull();
        // last section repeats A
        expect(s.slice(48)).toEqual(s.slice(0, 16));
        // second A: first half identical, second half lifted by one (capped at 9)
        expect(s.slice(16, 24)).toEqual(s.slice(0, 8));
        for (let k = 8; k < 16; k++) {
          const a = s[k];
          expect(s[16 + k]).toBe(a == null ? null : Math.min(9, a + 1));
        }
      }),
    );
  });

  it('phrase never rests on downbeats and with rest=0 never rests', () => {
    const p = phrase(16, 4, 1, seeded(3));
    for (let k = 0; k < 16; k += 4) expect(p[k]).not.toBeNull();
    expect(phrase(16, 4, 0, seeded(3)).every((n) => n !== null)).toBe(true);
  });

  it('stepIndex walks up then down the scale', () => {
    const seq = Array.from({ length: 20 }, (_, i) => stepIndex(i));
    expect(seq).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1]);
  });

  it('loop tempos match the mockup (140 BPM eighths, 66 BPM quarters)', () => {
    expect(loopStepSec('lively')).toBeCloseTo(60 / 140 / 2);
    expect(loopStepSec('calm')).toBeCloseTo(60 / 66);
  });

  it('clampVolume keeps 0.1–1', () => {
    expect(clampVolume(0)).toBe(0.1);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(Number.NaN)).toBe(0.7);
  });
});
