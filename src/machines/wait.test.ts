import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { createFakeAudio, type FakeAudio } from '@/audio/fake';
import { WAIT_FADE_SEC, waitMachine, type WaitInput } from './wait';

let audio: FakeAudio;
beforeEach(() => {
  vi.useFakeTimers();
  audio = createFakeAudio();
});
afterEach(() => {
  vi.useRealTimers();
});

function start(input: Partial<WaitInput> = {}) {
  const savePrefs = vi.fn();
  const exit = vi.fn();
  const actor = createActor(waitMachine, { input: { audio, now: () => Date.now(), savePrefs, exit, ...input } }).start();
  return { actor, savePrefs, exit };
}

const ticks = () => audio.callsOf('sfx').filter(([s]) => s === 'tick').length;
const ctx = (a: ReturnType<typeof start>['actor']) => a.getSnapshot().context;

describe('wait machine', () => {
  it('starts with calm music (tracks if any), saves prefs and counts down', async () => {
    const blob = new Blob(['x']);
    const h = start({ durationSec: 60, message: '  Cất sách vở  ', calmTracks: () => [blob] });
    h.actor.send({ type: 'TOGGLE' });
    expect(h.actor.getSnapshot().matches({ active: 'running' })).toBe(true);
    expect(audio.callsOf('startMusic')).toEqual([['calm', [blob]]]);
    expect(h.savePrefs).toHaveBeenCalledWith({ waitDurationSec: 60, waitMessage: 'Cất sách vở' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(ctx(h.actor).leftSec).toBeCloseTo(55, 5);
    expect(ticks()).toBe(0);
  });

  it('Space pauses and resumes without losing time', async () => {
    const h = start({ durationSec: 60 });
    h.actor.send({ type: 'TOGGLE' });
    await vi.advanceTimersByTimeAsync(2000);
    h.actor.send({ type: 'TOGGLE' });
    expect(h.actor.getSnapshot().matches({ active: 'paused' })).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ctx(h.actor).leftSec).toBeCloseTo(58, 5);
    expect(audio.music).not.toBeNull(); // music keeps playing while paused
    h.actor.send({ type: 'TOGGLE' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx(h.actor).leftSec).toBeCloseTo(57, 5);
  });

  it('+/- 30 s, never below 1 s; the ring total grows with +', async () => {
    const h = start({ durationSec: 60 });
    h.actor.send({ type: 'ADJUST', deltaSec: 30 }); // setup: ignored
    expect(ctx(h.actor).leftSec).toBe(60);
    h.actor.send({ type: 'TOGGLE' });
    h.actor.send({ type: 'ADJUST', deltaSec: 30 });
    expect(ctx(h.actor)).toMatchObject({ leftSec: 90, totalSec: 90 });
    h.actor.send({ type: 'ADJUST', deltaSec: -30 });
    h.actor.send({ type: 'ADJUST', deltaSec: -30 });
    h.actor.send({ type: 'ADJUST', deltaSec: -30 });
    expect(ctx(h.actor)).toMatchObject({ leftSec: 1, totalSec: 90 });
  });

  it('ticks once per second in the last 10 s, then fades out, chimes and stays done', async () => {
    const h = start({ durationSec: 12 });
    h.actor.send({ type: 'TOGGLE' });
    await vi.advanceTimersByTimeAsync(1900);
    expect(ticks()).toBe(0);
    await vi.advanceTimersByTimeAsync(200); // crosses into 10
    expect(ticks()).toBe(1);
    await vi.advanceTimersByTimeAsync(9000);
    expect(ticks()).toBe(10);
    expect(h.actor.getSnapshot().matches('active')).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.actor.getSnapshot().matches('done')).toBe(true);
    expect(ctx(h.actor).leftSec).toBe(0);
    expect(audio.callsOf('stopMusic')).toEqual([[{ fadeSec: WAIT_FADE_SEC }]]);
    expect(audio.callsOf('sfx').at(-1)).toEqual(['chime']);
    expect(ticks()).toBe(10);
    h.actor.send({ type: 'TOGGLE' }); // ignored
    h.actor.send({ type: 'ADJUST', deltaSec: -30 }); // ignored
    expect(h.actor.getSnapshot().matches('done')).toBe(true);
  });

  it('+ after the end runs 30 more seconds with music again', async () => {
    const h = start({ durationSec: 10 });
    h.actor.send({ type: 'TOGGLE' });
    await vi.advanceTimersByTimeAsync(10_200);
    expect(h.actor.getSnapshot().matches('done')).toBe(true);
    h.actor.send({ type: 'ADJUST', deltaSec: 30 });
    expect(h.actor.getSnapshot().matches({ active: 'running' })).toBe(true);
    expect(ctx(h.actor).leftSec).toBe(30);
    expect(audio.callsOf('startMusic')).toHaveLength(2);
  });

  it('Esc exits from anywhere and stops the music', () => {
    const h = start();
    h.actor.send({ type: 'TOGGLE' });
    h.actor.send({ type: 'EXIT' });
    expect(h.exit).toHaveBeenCalledOnce();
    expect(h.actor.getSnapshot().status).toBe('done');
    expect(audio.music).toBeNull();
  });

  it('stops music when the actor is stopped (unmount)', () => {
    const h = start();
    h.actor.send({ type: 'TOGGLE' });
    expect(audio.music).not.toBeNull();
    h.actor.stop();
    expect(audio.music).toBeNull();
  });

  it('setup: CONFIGURE / SET_* and message limited to 60 chars', () => {
    const h = start();
    h.actor.send({ type: 'CONFIGURE', durationSec: 300, message: 'Xếp hàng' });
    expect(ctx(h.actor)).toMatchObject({ durationSec: 300, message: 'Xếp hàng' });
    h.actor.send({ type: 'SET_DURATION', durationSec: 10 });
    h.actor.send({ type: 'SET_MESSAGE', message: 'a'.repeat(80) });
    expect(ctx(h.actor).durationSec).toBe(10);
    expect(ctx(h.actor).message).toHaveLength(60);
  });
});
