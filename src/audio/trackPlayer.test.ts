import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { pickRandom } from './music';
import { seededRng } from './seededRng';
import { AVOID_TAIL_SEC, defaultsFor, pickStartOffset } from './trackPlayer';

describe('pickStartOffset', () => {
  it('never starts within the last 10 s', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10.001, max: 3600, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (d, r) => {
          const off = pickStartOffset(d, () => r);
          expect(off).toBeGreaterThanOrEqual(0);
          expect(off).toBeLessThan(d - AVOID_TAIL_SEC);
        },
      ),
    );
  });

  it('maps rng linearly over the allowed span', () => {
    expect(pickStartOffset(130, () => 0)).toBe(0);
    expect(pickStartOffset(130, () => 0.5)).toBe(60);
  });

  it('short or invalid tracks start at 0', () => {
    expect(pickStartOffset(8, () => 0.9)).toBe(0);
    expect(pickStartOffset(10, () => 0.9)).toBe(0);
    expect(pickStartOffset(Number.NaN, () => 0.9)).toBe(0);
    expect(pickStartOffset(Infinity, () => 0.9)).toBe(0);
  });

  it('is deterministic with a seeded rng', () => {
    expect(pickStartOffset(200, seededRng(5))).toBe(pickStartOffset(200, seededRng(5)));
  });
});

describe('mood defaults', () => {
  it('lively = random start, no fade; calm = 1.5 s fade-in, loop', () => {
    expect(defaultsFor('lively')).toEqual({ randomStart: true, loop: true, fadeInSec: 0 });
    expect(defaultsFor('calm')).toEqual({ randomStart: false, loop: true, fadeInSec: 1.5 });
  });
});

describe('pickRandom', () => {
  it('returns undefined for empty and covers every element', () => {
    expect(pickRandom([], Math.random)).toBeUndefined();
    const items = ['a', 'b', 'c'];
    expect(pickRandom(items, () => 0)).toBe('a');
    expect(pickRandom(items, () => 0.999999)).toBe('c');
    expect(pickRandom(items, () => 1)).toBe('c');
  });
});
