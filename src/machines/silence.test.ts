import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { createFakeAudio, type FakeAudio } from '@/audio/fake';
import { DEFAULT_FUN_CHALLENGES } from '@/domain/defaults';
import { CHALLENGE_ROLLS, POP_OPTIONS_DELAY_MS, SILENCE_TEXT, WIN_CARD_DELAY_MS, silenceMachine, type SilenceInput } from './silence';

const STEP_MS = 100; // one fake mic level every 100 ms → dt = 0.1 s
const QUIET = -60;
const LOUD = -20;

const repeat = (db: number, n: number) => Array.from({ length: n }, () => db);

function start(audio: FakeAudio, input: Partial<SilenceInput> = {}) {
  const notify = vi.fn();
  const savePrefs = vi.fn();
  const exit = vi.fn();
  const celebrate = vi.fn();
  const actor = createActor(silenceMachine, {
    input: { audio, now: () => Date.now(), rng: () => 0, notify, savePrefs, exit, celebrate, ...input },
  }).start();
  return { actor, notify, savePrefs, exit, celebrate };
}

/** Script levels on the current mic and let them play out. */
async function feed(audio: FakeAudio, levels: readonly number[]) {
  audio.mic!.script(levels);
  await vi.advanceTimersByTimeAsync(levels.length * STEP_MS);
}

/** START, open the mic and calibrate on a quiet room (baseline −60 → threshold −46 on "Vừa"). */
async function startPlaying(audio: FakeAudio, input: Partial<SilenceInput> = {}, baseline = QUIET) {
  const h = start(audio, input);
  h.actor.send({ type: 'START' });
  await vi.advanceTimersByTimeAsync(0);
  expect(h.actor.getSnapshot().matches({ live: 'calibrating' })).toBe(true);
  await feed(audio, repeat(baseline, 31));
  return h;
}

let audio: FakeAudio;
beforeEach(() => {
  vi.useFakeTimers();
  audio = createFakeAudio({ mic: { intervalMs: STEP_MS } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('silence machine', () => {
  it('calibrates for 3 s: median baseline + margin, threshold hidden until done, tick on start', async () => {
    const h = start(audio, { difficulty: 'medium' });
    h.actor.send({ type: 'START' });
    expect(h.savePrefs).toHaveBeenCalledWith({ silenceDurationSec: 30, silenceDifficulty: 'medium' });
    expect(h.actor.getSnapshot().matches({ live: 'requestingMic' })).toBe(true);
    expect(audio.callsOf('stopMusic')).toHaveLength(1); // no music during the game
    await vi.advanceTimersByTimeAsync(0);
    // one loud clap during calibration does not move the median
    await feed(audio, [...repeat(-58, 15), -10, ...repeat(-58, 10)]);
    expect(h.actor.getSnapshot().matches({ live: 'calibrating' })).toBe(true);
    expect(h.actor.getSnapshot().context.thresholdDb).toBeNull();
    await feed(audio, repeat(-58, 6));
    const snap = h.actor.getSnapshot();
    expect(snap.matches({ live: 'playing' })).toBe(true);
    expect(snap.context.baselineDb).toBe(-58);
    expect(snap.context.thresholdDb).toBe(-44);
    expect(audio.callsOf('sfx')).toContainEqual(['tick']);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it('clamps and toasts when the room is noisy during calibration', async () => {
    const h = await startPlaying(audio, { difficulty: 'easy' }, -40);
    expect(h.actor.getSnapshot().context.thresholdDb).toBe(-20); // −40 + 20
    expect(h.notify).toHaveBeenCalledWith(SILENCE_TEXT.noisyBaseline);
    const loud = await startPlaying(createFakeAudio({ mic: { intervalMs: STEP_MS } }), {}, -25);
    expect(loud.actor.getSnapshot().context.thresholdDb).toBe(-16);
  });

  it('loses a heart only after > 1 s of accumulated noise, then 2 s grace', async () => {
    const h = await startPlaying(audio);
    await feed(audio, repeat(LOUD, 10)); // 1.0 s: not yet
    expect(h.actor.getSnapshot().context.game.hearts).toBe(3);
    expect(h.actor.getSnapshot().context.bubble).toBe(SILENCE_TEXT.noisy);
    await feed(audio, repeat(LOUD, 1)); // > 1 s
    let ctx = h.actor.getSnapshot().context;
    expect(ctx.game.hearts).toBe(2);
    expect(ctx.hits).toBe(1);
    expect(ctx.bubble).toBe(SILENCE_TEXT.hearts(2));
    expect(audio.callsOf('sfx')).toContainEqual(['beep']);
    // grace: 2 s of noise cost nothing
    await feed(audio, repeat(LOUD, 19));
    expect(h.actor.getSnapshot().context.game.hearts).toBe(2);
    // quiet decays the accumulator twice as fast
    await feed(audio, repeat(LOUD, 6)); // grace ends, ~0.5 s accumulated
    await feed(audio, repeat(QUIET, 3)); // −0.6 s → 0
    expect(h.actor.getSnapshot().context.bubble).toBe(SILENCE_TEXT.quiet);
    await feed(audio, repeat(LOUD, 10));
    ctx = h.actor.getSnapshot().context;
    expect(ctx.game.hearts).toBe(2);
  });

  it('pops after 3 lost hearts, closes the mic and shows the options after 0.9 s', async () => {
    const h = await startPlaying(audio);
    const mic = audio.mic!;
    await feed(audio, [...repeat(LOUD, 11), ...repeat(LOUD, 20), ...repeat(LOUD, 11), ...repeat(LOUD, 20), ...repeat(LOUD, 11)]);
    expect(h.actor.getSnapshot().matches({ popped: 'bursting' })).toBe(true);
    expect(mic.closed).toBe(true);
    expect(audio.callsOf('sfx')).toContainEqual(['pop']);
    h.actor.send({ type: 'OPTION', n: 1 }); // ignored while bursting
    expect(h.actor.getSnapshot().matches({ popped: 'bursting' })).toBe(true);
    await vi.advanceTimersByTimeAsync(POP_OPTIONS_DELAY_MS);
    expect(h.actor.getSnapshot().matches({ popped: 'choose' })).toBe(true);
    // 1 = replay: same settings, new mic, recalibrates
    h.actor.send({ type: 'OPTION', n: 1 });
    expect(h.actor.getSnapshot().matches({ live: 'requestingMic' })).toBe(true);
    expect(h.actor.getSnapshot().context.game.hearts).toBe(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.mics).toHaveLength(2);
  });

  it('wins when time runs out with hearts left; Space plays again, Esc back to setup', async () => {
    const h = await startPlaying(audio);
    const mic = audio.mic!;
    await feed(audio, repeat(QUIET, 301));
    expect(h.actor.getSnapshot().matches({ won: 'flying' })).toBe(true);
    expect(mic.closed).toBe(true);
    expect(audio.callsOf('sfx')).toContainEqual(['win']);
    expect(h.celebrate).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(WIN_CARD_DELAY_MS);
    expect(h.actor.getSnapshot().matches({ won: 'card' })).toBe(true);
    h.actor.send({ type: 'START' });
    expect(h.actor.getSnapshot().matches('live')).toBe(true);
    h.actor.send({ type: 'EXIT' });
    expect(h.actor.getSnapshot().matches('setup')).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.mics).toHaveLength(2);
    expect(audio.mic!.closed).toBe(true);
  });

  it('option 2 makes both duration and difficulty one step harder, toasts and saves', async () => {
    const h = await startPlaying(audio, { durationSec: 30, difficulty: 'easy' });
    await feed(audio, repeat(LOUD, 11 + 20 + 11 + 20 + 11));
    await vi.advanceTimersByTimeAsync(POP_OPTIONS_DELAY_MS);
    h.actor.send({ type: 'OPTION', n: 2 });
    const ctx = h.actor.getSnapshot().context;
    expect(ctx.durationSec).toBe(60);
    expect(ctx.difficulty).toBe('medium');
    expect(ctx.leftSec).toBe(60);
    expect(h.notify).toHaveBeenLastCalledWith('Khó hơn: 1:00 · độ khó Vừa');
    expect(h.savePrefs).toHaveBeenLastCalledWith({ silenceDurationSec: 60, silenceDifficulty: 'medium' });
    expect(h.actor.getSnapshot().matches('live')).toBe(true);
  });

  it('option 3 rolls 14 slowing ticks then ta-da; 1 replays, 4 exits', async () => {
    const h = await startPlaying(audio, { challenges: ['A', 'B'], rng: () => 0.7 });
    await feed(audio, repeat(LOUD, 11 + 20 + 11 + 20 + 11));
    await vi.advanceTimersByTimeAsync(POP_OPTIONS_DELAY_MS);
    const before = audio.callsOf('sfx').length;
    h.actor.send({ type: 'OPTION', n: 3 });
    expect(h.actor.getSnapshot().matches({ challenge: 'rolling' })).toBe(true);
    expect(h.actor.getSnapshot().context.challengeText).toBe('B');
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.actor.getSnapshot().matches({ challenge: 'done' })).toBe(true);
    const sfx = audio.callsOf('sfx').slice(before).map((a) => a[0]);
    expect(sfx.filter((s) => s === 'tick')).toHaveLength(CHALLENGE_ROLLS);
    expect(sfx.at(-1)).toBe('tada');
    h.actor.send({ type: 'OPTION', n: 4 });
    expect(h.actor.getSnapshot().status).toBe('done');
    expect(h.exit).toHaveBeenCalledOnce();
  });

  it('falls back to default challenges when the list is empty', async () => {
    const h = await startPlaying(audio, { challenges: [] });
    await feed(audio, repeat(LOUD, 11 + 20 + 11 + 20 + 11));
    await vi.advanceTimersByTimeAsync(POP_OPTIONS_DELAY_MS);
    h.actor.send({ type: 'OPTION', n: 3 });
    expect(h.actor.getSnapshot().context.challengeText).toBe(DEFAULT_FUN_CHALLENGES[0]);
  });

  it('↑/↓ nudge the threshold by 2 dB only while playing, clamped with a toast', async () => {
    const h = start(audio);
    h.actor.send({ type: 'START' });
    await vi.advanceTimersByTimeAsync(0);
    h.actor.send({ type: 'NUDGE_UP' }); // calibrating: ignored
    expect(h.notify).not.toHaveBeenCalled();
    await feed(audio, repeat(QUIET, 31));
    expect(h.actor.getSnapshot().context.thresholdDb).toBe(-46);
    h.actor.send({ type: 'NUDGE_UP' });
    expect(h.actor.getSnapshot().context.thresholdDb).toBe(-44);
    expect(h.notify).toHaveBeenLastCalledWith(SILENCE_TEXT.nudgeUp);
    for (let i = 0; i < 10; i++) h.actor.send({ type: 'NUDGE_DOWN' });
    expect(h.actor.getSnapshot().context.thresholdDb).toBe(-52);
    expect(h.notify).toHaveBeenLastCalledWith(SILENCE_TEXT.nudgeLimit);
    for (let i = 0; i < 30; i++) h.actor.send({ type: 'NUDGE_UP' });
    expect(h.actor.getSnapshot().context.thresholdDb).toBe(-16);
  });

  it('denied mic → error state; retry restarts; Esc goes back to setup', async () => {
    audio.setMicOptions({ error: 'denied', intervalMs: STEP_MS });
    const h = start(audio);
    h.actor.send({ type: 'START' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.actor.getSnapshot().matches('micError')).toBe(true);
    expect(h.actor.getSnapshot().context.micError).toBe('denied');
    audio.setMicOptions({ intervalMs: STEP_MS });
    h.actor.send({ type: 'RETRY' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.actor.getSnapshot().matches({ live: 'calibrating' })).toBe(true);
    h.actor.send({ type: 'EXIT' });
    expect(h.actor.getSnapshot().matches('setup')).toBe(true);
  });

  it('mic ended mid-game pauses with hearts and time kept; retry resumes without recalibrating', async () => {
    const h = await startPlaying(audio);
    await feed(audio, [...repeat(QUIET, 50), ...repeat(LOUD, 11)]);
    const { leftSec, game, thresholdDb } = h.actor.getSnapshot().context;
    audio.mic!.end();
    expect(h.actor.getSnapshot().matches('micError')).toBe(true);
    expect(h.actor.getSnapshot().context.micError).toBe('ended');
    await vi.advanceTimersByTimeAsync(5000); // paused: nothing moves
    h.actor.send({ type: 'RETRY' });
    await vi.advanceTimersByTimeAsync(0);
    const ctx = h.actor.getSnapshot().context;
    expect(h.actor.getSnapshot().matches({ live: 'playing' })).toBe(true);
    expect(ctx.leftSec).toBe(leftSec);
    expect(ctx.game.hearts).toBe(game.hearts);
    expect(ctx.thresholdDb).toBe(thresholdDb);
  });

  it('closes the mic when stopped (unmount) and on Esc', async () => {
    const h = await startPlaying(audio);
    h.actor.send({ type: 'EXIT' });
    expect(audio.mic!.closed).toBe(true);
    h.actor.send({ type: 'START' });
    await vi.advanceTimersByTimeAsync(0);
    const mic = audio.mic!;
    expect(mic.closed).toBe(false);
    h.actor.stop();
    expect(mic.closed).toBe(true);
  });

  it('a mic that opens after leaving is closed immediately', async () => {
    const h = start(audio);
    h.actor.send({ type: 'START' });
    h.actor.send({ type: 'EXIT' });
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.mic!.closed).toBe(true);
    expect(h.actor.getSnapshot().matches('setup')).toBe(true);
  });

  it('setup: CONFIGURE / SET_* change settings; Esc on setup exits', () => {
    const h = start(audio);
    h.actor.send({ type: 'CONFIGURE', durationSec: 120, difficulty: 'hard' });
    expect(h.actor.getSnapshot().context).toMatchObject({ durationSec: 120, difficulty: 'hard', leftSec: 120 });
    h.actor.send({ type: 'SET_DURATION', durationSec: 60 });
    h.actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' });
    expect(h.actor.getSnapshot().context).toMatchObject({ durationSec: 60, difficulty: 'easy' });
    h.actor.send({ type: 'EXIT' });
    expect(h.exit).toHaveBeenCalledOnce();
  });
});
