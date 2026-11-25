import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeAudio } from './fake';
import { MicError } from './types';

afterEach(() => {
  vi.useRealTimers();
});

describe('createFakeAudio', () => {
  it('records calls in order', () => {
    const a = createFakeAudio();
    a.ensure();
    a.sfx('tada');
    a.step(3);
    a.roll(1.4);
    expect(a.calls.map((c) => c.method)).toEqual(['ensure', 'sfx', 'step', 'roll']);
    expect(a.callsOf('sfx')).toEqual([['tada']]);
    expect(a.callsOf('roll')).toEqual([[1.4]]);
  });

  it('music: track when blobs given, synth fallback otherwise, stop clears', async () => {
    const a = createFakeAudio();
    expect(await a.startMusic('calm')).toBe('synth');
    expect(a.music).toEqual({ mood: 'calm', source: 'synth' });
    expect(await a.startMusic('lively', [new Blob(['x'])])).toBe('track');
    expect(a.music).toEqual({ mood: 'lively', source: 'track' });
    a.stopMusic({ fadeSec: 1.5 });
    expect(a.music).toBeNull();
    expect(a.callsOf('stopMusic')).toEqual([[{ fadeSec: 1.5 }]]);
  });

  it('volume is clamped like the real one; mute is independent', () => {
    const a = createFakeAudio();
    expect(a.getVolume()).toBe(0.7);
    expect(a.setVolume(5)).toBe(1);
    expect(a.setVolume(0)).toBe(0.1);
    a.setMuted(true);
    expect(a.isMuted()).toBe(true);
    expect(a.getVolume()).toBe(0.1);
  });

  it('openMic rejects with a typed error when scripted to', async () => {
    const a = createFakeAudio({ mic: { error: 'denied' } });
    const err = await a.openMic().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MicError);
    expect((err as MicError).kind).toBe('denied');
  });

  it('fake mic emits scripted levels over time', async () => {
    vi.useFakeTimers();
    const a = createFakeAudio({ mic: { levels: [-60, -55, -20], intervalMs: 100 } });
    const mic = await a.openMic('dev1');
    const got: number[] = [];
    mic.onLevel((l) => got.push(l));
    vi.advanceTimersByTime(250);
    expect(got).toEqual([-60, -55]);
    vi.advanceTimersByTime(100);
    expect(got).toEqual([-60, -55, -20]);
    expect(a.mic?.deviceId).toBe('dev1');
  });

  it('emit / flush / end / close', async () => {
    const a = createFakeAudio();
    const mic = await a.openMic();
    const got: number[] = [];
    const errors: string[] = [];
    mic.onLevel((l) => got.push(l));
    mic.onError((e) => errors.push(e.kind));
    a.mic?.emit(-42);
    a.mic?.script([-30, -31]);
    a.mic?.flush();
    expect(got).toEqual([-42, -30, -31]);
    a.mic?.end();
    expect(errors).toEqual(['ended']);
    expect(mic.closed).toBe(true);
    a.mic?.emit(-1);
    expect(got).toHaveLength(3);
    mic.close(); // idempotent
  });
});
