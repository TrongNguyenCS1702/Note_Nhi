import Dexie from 'dexie';
import { WEEK_MS } from '@/domain/fairness';
import { callLogSchema, type CallLogRow, type CallMethod, type CallStatus } from '@/domain/schemas';
import { db } from '../db';
import { insertRow, isLive, patchRow } from './base';

export interface LogCallInput {
  sessionId: string;
  classId: string;
  studentId: string;
  method: CallMethod;
  /** Defaults to 'chairs'. */
  game?: string;
}

/** Record a pick immediately (status 'called'); returns the CallLog id. */
export async function logCall(input: LogCallInput, now = Date.now()): Promise<string> {
  const row = await insertRow(
    db.callLogs,
    callLogSchema,
    { sessionId: input.sessionId, classId: input.classId, studentId: input.studentId, game: input.game ?? 'chairs', method: input.method, status: 'called', at: now },
    now,
  );
  return row.id;
}

/** R → 'skipped', V → 'absent'. The log is never deleted. */
export async function setCallStatus(id: string, status: CallStatus, now = Date.now()): Promise<CallLogRow> {
  return patchRow(db.callLogs, callLogSchema, id, { status }, now);
}

/** Live call logs of a class with `at >= since`, oldest first. */
export async function callLogsForClassSince(classId: string, since: number): Promise<CallLogRow[]> {
  const rows = await db.callLogs.where('[classId+at]').between([classId, since], [classId, Dexie.maxKey], true, true).toArray();
  return rows.filter((r) => isLive(r));
}

/**
 * Call logs of the last 7 days: exactly what the fairness picker needs (students absent
 * from it are "not called this week"; the oldest-lastCalledAt fallback only applies when
 * everyone is in it).
 */
export function recentCallLogs(classId: string, now = Date.now()): Promise<CallLogRow[]> {
  return callLogsForClassSince(classId, now - WEEK_MS);
}

/** All live call logs of a class (full history). The picker only needs `recentCallLogs`. */
export async function callLogsForClass(classId: string): Promise<CallLogRow[]> {
  return callLogsForClassSince(classId, 0);
}
