import { attendanceSchema, classSchema, sessionSchema, type AttendanceRow, type SessionRow } from '@/domain/schemas';
import { HISTORY_DAYS, suggestClass, type ClassSuggestion } from '@/domain/suggest';
import { localDateKey } from '@/domain/time';
import { db } from '../db';
import { getLocalOwnerId } from '../meta';
import { buildRow, isLive, patchRow } from './base';
import { listClasses } from './classes';
import { listScheduleSlots } from './schedule';

/** Today's (local date) session of a class, if any. */
export async function getTodaySession(classId: string, now = Date.now()): Promise<SessionRow | undefined> {
  const rows = await db.sessions.where('[classId+date]').equals([classId, localDateKey(now)]).toArray();
  return rows.filter((s) => isLive(s)).sort((a, b) => a.startedAt - b.startedAt)[0];
}

/**
 * Get or create today's session (date = local YYYY-MM-DD, startedAt = now) and
 * mark the class as used. Entering the same class again the same day reuses it.
 */
export async function getOrCreateTodaySession(classId: string, now = Date.now()): Promise<SessionRow> {
  const ownerId = await getLocalOwnerId();
  return db.transaction('rw', db.sessions, db.classes, async () => {
    await patchRow(db.classes, classSchema, classId, { lastUsedAt: now }, now);
    const existing = await getTodaySession(classId, now);
    if (existing) return existing;
    const row = await buildRow(sessionSchema, { classId, date: localDateKey(now), startedAt: now }, now, ownerId);
    await db.sessions.add(row);
    return row;
  });
}

export async function getSession(id: string): Promise<SessionRow | undefined> {
  const s = await db.sessions.get(id);
  return isLive(s) ? s : undefined;
}

/** Sessions started at or after `since` (for class suggestion). */
export async function listSessionsSince(since: number): Promise<SessionRow[]> {
  const rows = await db.sessions.where('startedAt').aboveOrEqual(since).toArray();
  return rows.filter((s) => isLive(s));
}

/** Mark attendance as confirmed (Enter on the attendance screen). */
export async function confirmAttendance(sessionId: string, now = Date.now()): Promise<SessionRow> {
  return patchRow(db.sessions, sessionSchema, sessionId, { attendanceConfirmedAt: now }, now);
}

/** Ids of students marked absent in a session. */
export async function absentStudentIds(sessionId: string): Promise<Set<string>> {
  const rows = await db.attendance.where('sessionId').equals(sessionId).toArray();
  return new Set(rows.filter((r) => isLive(r)).map((r) => r.studentId));
}

/**
 * Set or clear "absent" for one student in a session. Clearing soft-deletes the
 * Attendance row; setting again revives it (one row per session+student).
 */
export async function setAbsent(sessionId: string, studentId: string, absent: boolean, now = Date.now()): Promise<void> {
  const ownerId = await getLocalOwnerId();
  await db.transaction('rw', db.attendance, async () => {
    const rows = await db.attendance.where('[sessionId+studentId]').equals([sessionId, studentId]).toArray();
    const live = rows.find((r) => isLive(r));
    if (absent) {
      if (live) return;
      const dead = rows[0];
      if (dead) {
        const { deletedAt: _d, ...rest } = dead;
        await db.attendance.put(attendanceSchema.parse({ ...rest, updatedAt: Math.max(now, dead.updatedAt) }));
      } else {
        await db.attendance.add(await buildRow(attendanceSchema, { sessionId, studentId, status: 'absent' }, now, ownerId));
      }
    } else {
      for (const r of rows.filter((x): x is AttendanceRow => isLive(x))) {
        await db.attendance.put({ ...r, deletedAt: now, updatedAt: Math.max(now, r.updatedAt) });
      }
    }
  });
}

/** Toggle absent; returns the new state. */
export async function toggleAbsent(sessionId: string, studentId: string, now = Date.now()): Promise<boolean> {
  const absent = !(await absentStudentIds(sessionId)).has(studentId);
  await setAbsent(sessionId, studentId, absent, now);
  return absent;
}

/** Home-screen suggestion (SPEC 3.0) among the current school year's classes. */
export async function suggestClassNow(now = Date.now()): Promise<ClassSuggestion | null> {
  const [classes, scheduleSlots, sessions] = await Promise.all([listClasses(), listScheduleSlots(), listSessionsSince(now - HISTORY_DAYS * 24 * 3600 * 1000)]);
  return suggestClass({ now, scheduleSlots, sessions, validClassIds: new Set(classes.map((c) => c.id)) });
}
