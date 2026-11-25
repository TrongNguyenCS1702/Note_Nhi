import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { createFakeAudio, type FakeAudio } from '@/audio/fake';
import { pickStudents, type CallLogLike } from '@/domain/fairness';
import {
  AUTO_STOP_MS,
  BETWEEN_PICKS_MS,
  INTRO_MS,
  METHODS,
  NO_ONE_LEFT,
  REVEAL_MS,
  chairsMachine,
  phaseOf,
  spinLabel,
  type ChairsServices,
} from './chairs';

/** Deterministic LCG in [0, 1). */
function seeded(seed = 1): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

interface World {
  services: ChairsServices;
  audio: FakeAudio;
  logs: Array<CallLogLike & { id: string; method: string }>;
  absent: Set<string>;
  notices: string[];
  statusCalls: Array<[string, string]>;
}

function makeWorld(studentIds: string[], opts: { rng?: () => number; now?: number } = {}): World {
  const audio = createFakeAudio();
  const logs: World['logs'] = [];
  const absent = new Set<string>();
  const notices: string[] = [];
  const statusCalls: Array<[string, string]> = [];
  const rng = opts.rng ?? seeded(7);
  const now = opts.now ?? 1_800_000_000_000;
  const services: ChairsServices = {
    audio,
    rng,
    now: () => now,
    pick: (count, exclude) =>
      pickStudents({
        students: studentIds.filter((id) => !absent.has(id)).map((id) => ({ id })),
        callLogs: logs,
        count,
        exclude,
        now,
        rng,
      }).map((s) => s.id),
    log: (studentId, method) => {
      const id = `log${logs.length + 1}`;
      logs.push({ id, studentId, method, status: 'called', at: now });
      return Promise.resolve(id);
    },
    setStatus: (id, status) => {
      statusCalls.push([id, status]);
      const l = logs.find((x) => x.id === id);
      if (l) l.status = status;
      return Promise.resolve();
    },
    markAbsent: (id) => {
      absent.add(id);
      return Promise.resolve();
    },
    tracks: () => [],
    notify: (m) => notices.push(m),
  };
  return { services, audio, logs, absent, notices, statusCalls };
}

const start = (w: World, duo = false) => createActor(chairsMachine, { input: { services: w.services, duo } }).start();
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('chairs machine', () => {
  it('runs idle → intro → fast → slow → landed → result → idle', async () => {
    const w = makeWorld(['a', 'b', 'c']);
    const a = start(w);
    expect(phaseOf(a.getSnapshot())).toBe('idle');

    a.send({ type: 'SPACE' });
    expect(phaseOf(a.getSnapshot())).toBe('intro');
    expect(w.audio.callsOf('ensure')).toHaveLength(1);
    // result decided and logged before any animation
    expect(a.getSnapshot().context.picks).toHaveLength(1);
    expect(w.logs).toHaveLength(1);
    expect(w.logs[0]!.studentId).toBe(a.getSnapshot().context.picks[0]!.studentId);

    a.send({ type: 'SPACE' }); // ignored during the banner
    expect(phaseOf(a.getSnapshot())).toBe('intro');

    await vi.advanceTimersByTimeAsync(INTRO_MS);
    expect(phaseOf(a.getSnapshot())).toBe('fast');
    expect(w.audio.callsOf('startMusic')).toEqual([['lively', []]]);
    const auto = a.getSnapshot().context.autoStopMs;
    expect(auto).toBeGreaterThanOrEqual(AUTO_STOP_MS.first[0]);
    expect(auto).toBeLessThanOrEqual(AUTO_STOP_MS.first[1]);

    await vi.advanceTimersByTimeAsync(auto);
    expect(phaseOf(a.getSnapshot())).toBe('slow');
    expect(w.audio.callsOf('stopMusic')).toHaveLength(1);

    a.send({ type: 'ANIM_FAKEOUT' });
    expect(phaseOf(a.getSnapshot())).toBe('fakeout');
    expect(w.audio.callsOf('roll')).toEqual([[1.3]]);

    a.send({ type: 'ANIM_LANDED' });
    expect(phaseOf(a.getSnapshot())).toBe('revealing');
    await vi.advanceTimersByTimeAsync(REVEAL_MS);
    expect(phaseOf(a.getSnapshot())).toBe('result');
    expect(w.audio.callsOf('sfx')).toEqual([['tada']]);

    a.send({ type: 'SPACE' });
    expect(phaseOf(a.getSnapshot())).toBe('idle');
    expect(w.logs[0]!.status).toBe('called');
  });

  it('SPACE in fast stops the music early; SPACE in slow skips to the result', async () => {
    const w = makeWorld(['a', 'b']);
    const a = start(w);
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(INTRO_MS);
    expect(spinLabel(phaseOf(a.getSnapshot()))).toBe('Dừng nhạc');
    a.send({ type: 'SPACE' });
    expect(phaseOf(a.getSnapshot())).toBe('slow');
    expect(w.audio.music).toBeNull();
    expect(spinLabel(phaseOf(a.getSnapshot()))).toBe('Tua nhanh');
    a.send({ type: 'SPACE' });
    expect(phaseOf(a.getSnapshot())).toBe('revealing');
    a.send({ type: 'SPACE' }); // ignored while the overlay is coming
    await vi.advanceTimersByTimeAsync(REVEAL_MS);
    expect(phaseOf(a.getSnapshot())).toBe('result');
  });

  it('SPACE during the fake-out also skips to the result', async () => {
    const w = makeWorld(['a', 'b']);
    const a = start(w);
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(INTRO_MS);
    a.send({ type: 'SPACE' });
    a.send({ type: 'ANIM_FAKEOUT' });
    a.send({ type: 'SPACE' });
    expect(phaseOf(a.getSnapshot())).toBe('revealing');
  });

  it('duo picks two distinct students and plays two music rounds', async () => {
    const w = makeWorld(['a', 'b', 'c', 'd']);
    const a = start(w);
    a.send({ type: 'TOGGLE_DUO' });
    expect(a.getSnapshot().context.duo).toBe(true);
    a.send({ type: 'SPACE' });
    const ids = a.getSnapshot().context.picks.map((p) => p.studentId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(w.logs.map((l) => l.studentId)).toEqual(ids);

    a.send({ type: 'TOGGLE_DUO' }); // only in idle
    expect(a.getSnapshot().context.duo).toBe(true);

    await vi.advanceTimersByTimeAsync(INTRO_MS);
    a.send({ type: 'SPACE' });
    a.send({ type: 'ANIM_LANDED' });
    expect(phaseOf(a.getSnapshot())).toBe('between');
    await vi.advanceTimersByTimeAsync(BETWEEN_PICKS_MS);
    expect(phaseOf(a.getSnapshot())).toBe('fast');
    expect(a.getSnapshot().context.pickIndex).toBe(1);
    const auto = a.getSnapshot().context.autoStopMs;
    expect(auto).toBeGreaterThanOrEqual(AUTO_STOP_MS.next[0]);
    expect(auto).toBeLessThanOrEqual(AUTO_STOP_MS.next[1]);
    expect(w.audio.callsOf('startMusic')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(auto);
    a.send({ type: 'ANIM_LANDED' });
    await vi.advanceTimersByTimeAsync(REVEAL_MS);
    expect(phaseOf(a.getSnapshot())).toBe('result');

    a.send({ type: 'ABSENT' }); // hidden for duo
    expect(phaseOf(a.getSnapshot())).toBe('result');
  });

  it('duo with one student left calls just one', () => {
    const w = makeWorld(['a']);
    const a = start(w, true);
    a.send({ type: 'SPACE' });
    expect(a.getSnapshot().context.picks.map((p) => p.studentId)).toEqual(['a']);
  });

  it('R marks the call skipped and re-spins without that student', async () => {
    const w = makeWorld(['a', 'b', 'c']);
    const a = start(w);
    a.send({ type: 'SPACE' });
    a.send({ type: 'SPACE' }); // ignored in intro
    await vi.advanceTimersByTimeAsync(INTRO_MS);
    a.send({ type: 'SPACE' });
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(REVEAL_MS);
    const first = a.getSnapshot().context.picks[0]!.studentId;
    const method = a.getSnapshot().context.method;

    a.send({ type: 'REROLL' });
    await flush();
    expect(phaseOf(a.getSnapshot())).toBe('intro');
    expect(w.statusCalls).toEqual([['log1', 'skipped']]);
    expect(w.logs[0]!.status).toBe('skipped');
    const second = a.getSnapshot().context.picks[0]!.studentId;
    expect(second).not.toBe(first);
    expect(a.getSnapshot().context.method).not.toBe(method);
    expect(w.logs).toHaveLength(2);
  });

  it('V marks the call absent, records absence today and re-spins', async () => {
    const w = makeWorld(['a', 'b']);
    const a = start(w);
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(INTRO_MS);
    a.send({ type: 'SPACE' });
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(REVEAL_MS);
    const first = a.getSnapshot().context.picks[0]!.studentId;

    a.send({ type: 'ABSENT' });
    await flush();
    expect(w.statusCalls).toEqual([['log1', 'absent']]);
    expect([...w.absent]).toEqual([first]);
    expect(a.getSnapshot().context.absentMarked).toEqual([first]);
    expect(phaseOf(a.getSnapshot())).toBe('intro');
    expect(a.getSnapshot().context.picks[0]!.studentId).not.toBe(first);
  });

  it('never picks absent students, and toasts when nobody is left', async () => {
    const w = makeWorld(['a', 'b']);
    w.absent.add('a');
    const a = start(w);
    a.send({ type: 'SPACE' });
    expect(a.getSnapshot().context.picks[0]!.studentId).toBe('b');
    await vi.advanceTimersByTimeAsync(INTRO_MS);
    a.send({ type: 'SPACE' });
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(REVEAL_MS);
    a.send({ type: 'ABSENT' }); // b absent too → nobody left
    await flush();
    expect(phaseOf(a.getSnapshot())).toBe('idle');
    expect(w.notices).toEqual([NO_ONE_LEFT]);
    a.send({ type: 'SPACE' });
    expect(phaseOf(a.getSnapshot())).toBe('idle');
    expect(w.notices).toHaveLength(2);
  });

  it('never repeats the previous method', async () => {
    const w = makeWorld(['a', 'b', 'c'], { rng: seeded(42) });
    const a = start(w);
    let last: string | null = null;
    for (let i = 0; i < 20; i++) {
      a.send({ type: 'SPACE' });
      const m = a.getSnapshot().context.method;
      expect(METHODS).toContain(m);
      expect(m).not.toBe(last);
      last = m;
      await vi.advanceTimersByTimeAsync(INTRO_MS);
      a.send({ type: 'SPACE' });
      a.send({ type: 'SPACE' });
      await vi.advanceTimersByTimeAsync(REVEAL_MS);
      a.send({ type: 'CONTINUE' });
    }
  });

  it('EXIT from the middle of a spin stops the music', async () => {
    const w = makeWorld(['a']);
    const a = start(w);
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(INTRO_MS);
    expect(w.audio.music).not.toBeNull();
    a.send({ type: 'EXIT' });
    expect(a.getSnapshot().status).toBe('done');
    expect(w.audio.music).toBeNull();
  });

  it('a stalled reveal still reaches the result', async () => {
    const w = makeWorld(['a']);
    const a = start(w);
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(INTRO_MS);
    a.send({ type: 'SPACE' });
    await vi.advanceTimersByTimeAsync(30000 + REVEAL_MS);
    expect(phaseOf(a.getSnapshot())).toBe('result');
  });
});
