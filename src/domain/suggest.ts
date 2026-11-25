import { minuteOfDay, weekdayOf } from './time';

export const SLOT_BEFORE_MIN = 15;
export const SLOT_AFTER_MIN = 40;
export const HISTORY_DAYS = 28;
export const HISTORY_TOLERANCE_MIN = 30;

export interface SlotLike {
  weekday: number;
  startMin: number;
  classId: string;
  deletedAt?: number | undefined;
}

export interface SessionLike {
  classId: string;
  startedAt: number;
  deletedAt?: number | undefined;
}

export interface ClassSuggestion {
  classId: string;
  reason: 'timetable' | 'history';
  /** Timetable slot start (minutes since midnight) when reason = 'timetable'. */
  startMin?: number;
}

/**
 * Suggested class for the home screen (SPEC 3.0):
 * 1. a timetable slot on the same weekday with now ∈ [start − 15, start + 40] min (closest start wins);
 * 2. else sessions of the last 28 days on the same weekday whose start time is within ±30 min
 *    of now → most frequent class (tie → most recent);
 * 3. else null.
 * `validClassIds`, if given, restricts suggestions to existing classes.
 */
export function suggestClass({
  now,
  scheduleSlots,
  sessions,
  validClassIds,
}: {
  now: number;
  scheduleSlots: readonly SlotLike[];
  sessions: readonly SessionLike[];
  validClassIds?: ReadonlySet<string>;
}): ClassSuggestion | null {
  const ok = (id: string) => !validClassIds || validClassIds.has(id);
  const wd = weekdayOf(now);
  const min = minuteOfDay(now);

  let best: SlotLike | null = null;
  for (const s of scheduleSlots) {
    if (s.deletedAt !== undefined || s.weekday !== wd || !ok(s.classId)) continue;
    if (min < s.startMin - SLOT_BEFORE_MIN || min > s.startMin + SLOT_AFTER_MIN) continue;
    if (!best || Math.abs(min - s.startMin) < Math.abs(min - best.startMin)) best = s;
  }
  if (best) return { classId: best.classId, reason: 'timetable', startMin: best.startMin };

  const since = now - HISTORY_DAYS * 24 * 3600 * 1000;
  const stats = new Map<string, { count: number; latest: number }>();
  for (const s of sessions) {
    if (s.deletedAt !== undefined || !ok(s.classId)) continue;
    if (s.startedAt < since || s.startedAt > now) continue;
    if (weekdayOf(s.startedAt) !== wd) continue;
    if (Math.abs(minuteOfDay(s.startedAt) - min) > HISTORY_TOLERANCE_MIN) continue;
    const st = stats.get(s.classId) ?? { count: 0, latest: 0 };
    st.count += 1;
    st.latest = Math.max(st.latest, s.startedAt);
    stats.set(s.classId, st);
  }
  let pick: { classId: string; count: number; latest: number } | null = null;
  for (const [classId, st] of stats) {
    if (!pick || st.count > pick.count || (st.count === pick.count && st.latest > pick.latest)) pick = { classId, ...st };
  }
  return pick ? { classId: pick.classId, reason: 'history' } : null;
}
