import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { dbfsToPercent, DBFS_FLOOR, MIC_CONSTRAINTS, MovingAverage, rms, rmsToDbfs, toMicError } from './micMeter';
import { MicError } from './types';

describe('rms / dBFS', () => {
  it('computes RMS', () => {
    expect(rms([])).toBe(0);
    expect(rms([0, 0, 0])).toBe(0);
    expect(rms([1, -1, 1, -1])).toBe(1);
    expect(rms([0.5, -0.5])).toBe(0.5);
  });

  it('full-scale sine is about −3 dBFS', () => {
    const s = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000));
    expect(rmsToDbfs(rms(s))).toBeCloseTo(-3.01, 1);
  });

  it('converts with 20·log10 and floors silence', () => {
    expect(rmsToDbfs(1)).toBeCloseTo(0);
    expect(rmsToDbfs(0.1)).toBeCloseTo(-20);
    expect(rmsToDbfs(0.001)).toBeCloseTo(-60);
    expect(rmsToDbfs(0)).toBe(DBFS_FLOOR);
    expect(rmsToDbfs(1e-9)).toBe(DBFS_FLOOR);
    expect(rmsToDbfs(Number.NaN)).toBe(DBFS_FLOOR);
  });

  it('dBFS is monotonic and floored', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(rmsToDbfs(lo)).toBeLessThanOrEqual(rmsToDbfs(hi));
        expect(rmsToDbfs(lo)).toBeGreaterThanOrEqual(DBFS_FLOOR);
      }),
    );
  });

  it('maps −70…−10 dBFS onto 0…100 %', () => {
    expect(dbfsToPercent(-70)).toBe(0);
    expect(dbfsToPercent(-40)).toBe(50);
    expect(dbfsToPercent(-10)).toBe(100);
    expect(dbfsToPercent(-100)).toBe(0);
    expect(dbfsToPercent(0)).toBe(100);
  });
});

describe('MovingAverage', () => {
  it('averages samples within the 300 ms window', () => {
    const m = new MovingAverage(300);
    expect(m.value).toBe(DBFS_FLOOR);
    expect(m.push(-60, 0)).toBe(-60);
    expect(m.push(-40, 100)).toBe(-50);
    expect(m.push(-20, 300)).toBe(-40);
    // t=400: sample at 0 drops out (400 − 0 > 300)
    expect(m.push(-20, 400)).toBeCloseTo((-40 - 20 - 20) / 3);
  });

  it('a single loud spike is softened, sustained noise converges', () => {
    const m = new MovingAverage(300);
    for (let t = 0; t <= 300; t += 16) m.push(-60, t);
    const spiked = m.push(0, 316);
    expect(spiked).toBeLessThan(-50);
    let v = spiked;
    for (let t = 332; t <= 800; t += 16) v = m.push(-20, t);
    expect(v).toBeCloseTo(-20);
  });

  it('reset clears history', () => {
    const m = new MovingAverage();
    m.push(-30, 0);
    m.reset();
    expect(m.value).toBe(DBFS_FLOOR);
  });
});

describe('mic setup', () => {
  it('disables all browser processing (AGC, NS, EC)', () => {
    expect(MIC_CONSTRAINTS).toEqual({ echoCancellation: false, noiseSuppression: false, autoGainControl: false });
  });

  it('maps getUserMedia errors to typed kinds', () => {
    const err = (name: string) => Object.assign(new Error(name), { name });
    expect(toMicError(err('NotAllowedError')).kind).toBe('denied');
    expect(toMicError(err('SecurityError')).kind).toBe('denied');
    expect(toMicError(err('NotFoundError')).kind).toBe('no-device');
    expect(toMicError(err('NotReadableError')).kind).toBe('no-device');
    expect(toMicError(err('TypeError')).kind).toBe('unsupported');
    expect(toMicError('weird').kind).toBe('unsupported');
    const e = new MicError('ended');
    expect(toMicError(e)).toBe(e);
  });
});
