import { describe, expect, it } from 'vitest';
import { suggestClass } from './suggest';
import { localDateKey, minuteOfDay, startOfLocalDay, weekdayOf } from './time';

// Wednesday 25/11/2026 08:05 local
const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).getTime();
const NOW = at(25, 8, 5);
const DAY = 24 * 3600 * 1000;

describe('time helpers', () => {
  it('work in local time', () => {
    expect(weekdayOf(NOW)).toBe(3); // Wednesday
    expect(weekdayOf(at(29, 9, 0))).toBe(7); // Sunday
    expect(minuteOfDay(NOW)).toBe(485);
    expect(localDateKey(NOW)).toBe('2026-11-25');
    expect(startOfLocalDay(NOW)).toBe(at(25, 0, 0));
  });
});

describe('suggestClass', () => {
  const wd = weekdayOf(NOW);

  it('uses the timetable window [start−15, start+40]', () => {
    const slots = [
      { weekday: wd, startMin: 8 * 60 + 15, classId: '3A' },
      { weekday: wd, startMin: 9 * 60, classId: '4B' },
    ];
    expect(suggestClass({ now: NOW, scheduleSlots: slots, sessions: [] })).toEqual({ classId: '3A', reason: 'timetable', startMin: 495 });
    expect(suggestClass({ now: at(25, 7, 59), scheduleSlots: slots, sessions: [] })).toBeNull();
    expect(suggestClass({ now: at(25, 8, 55), scheduleSlots: slots, sessions: [] })?.classId).toBe('4B'); // closest start
    expect(suggestClass({ now: at(25, 9, 41), scheduleSlots: slots, sessions: [] })).toBeNull();
  });

  it('ignores other weekdays, deleted slots and unknown classes', () => {
    const slots = [
      { weekday: wd === 7 ? 1 : wd + 1, startMin: 485, classId: 'X' },
      { weekday: wd, startMin: 485, classId: 'Y', deletedAt: 1 },
      { weekday: wd, startMin: 485, classId: 'Z' },
    ];
    expect(suggestClass({ now: NOW, scheduleSlots: slots, sessions: [], validClassIds: new Set(['X', 'Y']) })).toBeNull();
  });

  it('learns from same-weekday sessions within ±30 min in the last 28 days', () => {
    const sessions = [
      { classId: '3A', startedAt: NOW - 7 * DAY + 10 * 60e3 },
      { classId: '3A', startedAt: NOW - 14 * DAY - 25 * 60e3 },
      { classId: '5C', startedAt: NOW - 21 * DAY },
      { classId: '5C', startedAt: NOW - 1 * DAY }, // other weekday
      { classId: '5C', startedAt: NOW - 7 * DAY + 45 * 60e3 }, // too far in time
      { classId: '5C', startedAt: NOW - 35 * DAY }, // too old
    ];
    expect(suggestClass({ now: NOW, scheduleSlots: [], sessions })).toEqual({ classId: '3A', reason: 'history' });
  });

  it('ties go to the most recent class', () => {
    const sessions = [
      { classId: '3A', startedAt: NOW - 14 * DAY },
      { classId: '4A', startedAt: NOW - 7 * DAY },
    ];
    expect(suggestClass({ now: NOW, scheduleSlots: [], sessions })?.classId).toBe('4A');
  });

  it('timetable wins over history; nothing → null', () => {
    const sessions = [{ classId: '4A', startedAt: NOW - 7 * DAY }];
    expect(suggestClass({ now: NOW, scheduleSlots: [{ weekday: wd, startMin: 480, classId: '3A' }], sessions })?.reason).toBe('timetable');
    expect(suggestClass({ now: NOW, scheduleSlots: [], sessions: [] })).toBeNull();
  });
});
