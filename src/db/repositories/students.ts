import { displayNames } from '@/domain/displayNames';
import { studentSchema, type StudentRow } from '@/domain/schemas';
import { cleanText } from '@/domain/text';
import { db } from '../db';
import { insertRow, isLive, patchRow, softDelete } from './base';

/** Live students of a class sorted by roster order (archived excluded unless asked). */
export async function listStudents(classId: string, opts: { includeArchived?: boolean } = {}): Promise<StudentRow[]> {
  const rows = await db.students.where('classId').equals(classId).toArray();
  return rows.filter((s) => isLive(s) && (opts.includeArchived || !s.archived)).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function getStudent(id: string): Promise<StudentRow | undefined> {
  const s = await db.students.get(id);
  return isLive(s) ? s : undefined;
}

/**
 * Add one student at the end of the class. Its display name is generated against the
 * current class (other students keep theirs; call recomputeDisplayNames to refresh all).
 */
export async function addStudent(classId: string, fullName: string, now = Date.now()): Promise<StudentRow> {
  const name = cleanText(fullName);
  const current = await listStudents(classId);
  const names = displayNames([...current.map((s) => s.fullName), name]);
  const order = Math.max(0, ...current.map((s) => s.order)) + 1;
  return insertRow(db.students, studentSchema, { classId, order, fullName: name, displayName: names.at(-1)!, archived: false }, now);
}

export async function updateStudent(id: string, patch: { fullName?: string; order?: number }, now = Date.now()): Promise<StudentRow> {
  const p: { fullName?: string; order?: number } = {};
  if (patch.fullName !== undefined) p.fullName = cleanText(patch.fullName);
  if (patch.order !== undefined) p.order = patch.order;
  return patchRow(db.students, studentSchema, id, p, now);
}

/** Teacher edits the display name (double-click on a name). */
export async function renameStudent(id: string, displayName: string, now = Date.now()): Promise<StudentRow> {
  return patchRow(db.students, studentSchema, id, { displayName: cleanText(displayName) }, now);
}

/** Transferred / left students are archived, not deleted, to keep call history. */
export async function setStudentArchived(id: string, archived: boolean, now = Date.now()): Promise<StudentRow> {
  return patchRow(db.students, studentSchema, id, { archived }, now);
}

export async function deleteStudent(id: string, now = Date.now()): Promise<void> {
  await softDelete(db.students, id, now);
}

/** Regenerate display names for all non-archived students of a class (overwrites manual edits). */
export async function recomputeDisplayNames(classId: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.students, async () => {
    const students = await listStudents(classId);
    const names = displayNames(students.map((s) => s.fullName));
    const changed = students
      .map((s, i) => (s.displayName === names[i] ? null : studentSchema.parse({ ...s, displayName: names[i], updatedAt: Math.max(now, s.updatedAt) })))
      .filter((s): s is StudentRow => s !== null);
    await db.students.bulkPut(changed);
  });
}
