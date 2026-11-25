import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calledWithinWeek, countNotCalledThisWeek, lastCalledAt, pickStudents, WEEK_MS, type CallLogLike } from './fairness';
import type { CallStatus } from './schemas/tables';

const NOW = 1_800_000_000_000;
const DAY = 24 * 3600 * 1000;
const S = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));
const log = (studentId: string, at: number, status: CallStatus = 'called'): CallLogLike => ({ studentId, at, status });

describe('lastCalledAt / calledWithinWeek', () => {
  it('only counts non-deleted called logs', () => {
    const logs = [log('a', 10), log('a', 30, 'skipped'), log('a', 20), log('a', 40, 'absent'), { ...log('a', 50), deletedAt: 60 }];
    expect(lastCalledAt('a', logs)).toBe(20);
    expect(lastCalledAt('b', logs)).toBeNull();
  });

  it('7-day window', () => {
    expect(calledWithinWeek('a', [log('a', NOW - 6 * DAY)], NOW)).toBe(true);
    expect(calledWithinWeek('a', [log('a', NOW - WEEK_MS)], NOW)).toBe(false);
    expect(calledWithinWeek('a', [log('a', NOW, 'skipped')], NOW)).toBe(false);
    expect(countNotCalledThisWeek(S(3), [log('s0', NOW - DAY), log('s1', NOW - 8 * DAY)], NOW)).toBe(2);
  });
});

describe('pickStudents', () => {
  it('prefers students not called this week', () => {
    const logs = [log('s0', NOW - DAY), log('s1', NOW - DAY)];
    for (let r = 0; r < 1; r += 0.1) {
      expect(pickStudents({ students: S(3), callLogs: logs, count: 1, now: NOW, rng: () => r })[0]!.id).toBe('s2');
    }
  });

  it('rotates to the oldest lastCalledAt when everyone was called', () => {
    const logs = [log('s0', NOW - DAY), log('s1', NOW - 3 * DAY), log('s2', NOW - 2 * DAY)];
    expect(pickStudents({ students: S(3), callLogs: logs, count: 2, now: NOW, rng: () => 0.99 }).map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('handles empty pools and duo with one student left', () => {
    expect(pickStudents({ students: [], callLogs: [], count: 1, now: NOW, rng: () => 0 })).toEqual([]);
    expect(pickStudents({ students: S(1), callLogs: [], count: 2, now: NOW, rng: () => 0 })).toHaveLength(1);
    expect(pickStudents({ students: S(2), callLogs: [], count: 1, exclude: ['s0', 's1'], now: NOW, rng: () => 0 })).toEqual([]);
  });

  it('ignores archived students and tolerates rng() returning 1', () => {
    const students = [{ id: 'a', archived: true }, { id: 'b' }];
    expect(pickStudents({ students, callLogs: [], count: 2, now: NOW, rng: () => 1 }).map((s) => s.id)).toEqual(['b']);
  });

  // ---- property tests -----------------------------------------------------

  const statusArb = fc.constantFrom<CallStatus>('called', 'skipped', 'absent');
  const scenario = fc
    .record({
      size: fc.integer({ min: 0, max: 40 }),
      absentMask: fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }),
      excludeMask: fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }),
      logs: fc.array(fc.record({ who: fc.integer({ min: 0, max: 39 }), ageDays: fc.double({ min: 0, max: 30, noNaN: true }), status: statusArb }), { maxLength: 80 }),
      count: fc.integer({ min: 1, max: 2 }),
      seed: fc.array(fc.double({ min: 0, max: 0.999999, noNaN: true }), { minLength: 2, maxLength: 2 }),
    })
    .map(({ size, absentMask, excludeMask, logs, count, seed }) => {
      const all = S(size);
      const present = all.filter((_, i) => !absentMask[i]);
      const exclude = all.filter((_, i) => excludeMask[i] && i % 3 === 0).map((s) => s.id);
      const callLogs = logs.filter((l) => l.who < size).map((l) => log(`s${l.who}`, NOW - l.ageDays * DAY, l.status));
      let i = 0;
      const rng = () => seed[i++ % seed.length]!;
      return { all, present, absent: all.filter((_, i) => absentMask[i]), exclude, callLogs, count, rng };
    });

  it('property: never picks absent or excluded students; picks are distinct; count respected', () => {
    fc.assert(
      fc.property(scenario, ({ present, absent, exclude, callLogs, count, rng }) => {
        const picks = pickStudents({ students: present, callLogs, count, exclude, now: NOW, rng });
        const ids = picks.map((p) => p.id);
        const available = present.filter((s) => !exclude.includes(s.id)).length;
        expect(ids.length).toBe(Math.min(count, available));
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
          expect(absent.some((a) => a.id === id)).toBe(false);
          expect(exclude).not.toContain(id);
          expect(present.some((p) => p.id === id)).toBe(true);
        }
      }),
    );
  });

  it('property: never repeats a student called within 7 days while someone uncalled remains', () => {
    fc.assert(
      fc.property(scenario, ({ present, exclude, callLogs, count, rng }) => {
        const pool = present.filter((s) => !exclude.includes(s.id));
        const uncalled = pool.filter((s) => !calledWithinWeek(s.id, callLogs, NOW));
        const picks = pickStudents({ students: present, callLogs, count, exclude, now: NOW, rng });
        picks.forEach((p, k) => {
          // the k-th pick may only be a "called this week" student once all uncalled ones are used up
          if (uncalled.length > k) expect(calledWithinWeek(p.id, callLogs, NOW)).toBe(false);
        });
      }),
    );
  });

  it('property: when everyone was called this week, picks have the oldest lastCalledAt', () => {
    fc.assert(
      fc.property(scenario, ({ present, callLogs, rng }) => {
        const recent = present.map((s, i) => log(s.id, NOW - (i % 5) * DAY - 1));
        const logs = [...callLogs, ...recent];
        const [p] = pickStudents({ students: present, callLogs: logs, count: 1, now: NOW, rng });
        if (!p) return;
        const t = (id: string) => lastCalledAt(id, logs)!;
        expect(t(p.id)).toBe(Math.min(...present.map((s) => t(s.id))));
      }),
    );
  });

  it('property: skipped/absent logs do not count as called', () => {
    fc.assert(
      fc.property(scenario, ({ present, callLogs, count, rng }) => {
        const nonCalled = callLogs.map((l) => ({ ...l, status: l.status === 'called' ? ('skipped' as const) : l.status }));
        // with no real calls, every present student is in the priority group
        expect(countNotCalledThisWeek(present, nonCalled, NOW)).toBe(present.length);
        const a = pickStudents({ students: present, callLogs: nonCalled, count, now: NOW, rng });
        expect(a.length).toBe(Math.min(count, present.length));
      }),
    );
  });

  it('property: uniform among the priority group (every uncalled student can be picked)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), (n) => {
        const students = S(n);
        const got = new Set<string>();
        for (let i = 0; i < n; i++) {
          const r = (i + 0.5) / n;
          got.add(pickStudents({ students, callLogs: [], count: 1, now: NOW, rng: () => r })[0]!.id);
        }
        expect(got.size).toBe(n);
      }),
    );
  });
});
