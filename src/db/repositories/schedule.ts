import { scheduleSlotSchema, type ScheduleSlotRow } from '@/domain/schemas';
import { db } from '../db';
import { insertRow, isLive, patchRow, softDelete } from './base';

export type ScheduleSlotInput = Pick<ScheduleSlotRow, 'weekday' | 'startMin' | 'classId'>;

/** Live timetable slots sorted by weekday then start time. */
export async function listScheduleSlots(): Promise<ScheduleSlotRow[]> {
  const rows = await db.scheduleSlots.toArray();
  return rows.filter((r) => isLive(r)).sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
}

export function addScheduleSlot(input: ScheduleSlotInput, now = Date.now()): Promise<ScheduleSlotRow> {
  return insertRow(db.scheduleSlots, scheduleSlotSchema, input, now);
}

export function updateScheduleSlot(id: string, patch: Partial<ScheduleSlotInput>, now = Date.now()): Promise<ScheduleSlotRow> {
  return patchRow(db.scheduleSlots, scheduleSlotSchema, id, patch, now);
}

export function deleteScheduleSlot(id: string, now = Date.now()): Promise<void> {
  return softDelete(db.scheduleSlots, id, now);
}
