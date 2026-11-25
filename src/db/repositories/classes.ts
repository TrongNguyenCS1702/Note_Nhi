import { gradeFromClassName, nextSchoolYear, normalizeClassName, promoteClassName, schoolYearFor } from '@/domain/classInfo';
import { displayNames } from '@/domain/displayNames';
import type { RosterResult } from '@/domain/roster';
import { classSchema, studentSchema, type ClassRow, type Grade, type StudentRow } from '@/domain/schemas';
import { db } from '../db';
import { getLocalOwnerId } from '../meta';
import { buildRow, byName, isLive, patchRow, softDelete } from './base';

export interface ClassWithCount extends ClassRow {
  /** Live, non-archived students. */
  studentCount: number;
}

export interface GradeGroup {
  grade: Grade;
  classes: ClassWithCount[];
}

const GRADES: readonly Grade[] = [1, 2, 3, 4, 5];

/** Latest school year among live classes (what the home screen shows), or null if none. */
export async function currentSchoolYear(): Promise<string | null> {
  const years = new Set<string>();
  await db.classes.each((c) => {
    if (isLive(c)) years.add(c.schoolYear);
  });
  return [...years].sort().at(-1) ?? null;
}

/** Live classes of a school year (default: the current one), sorted by name. */
export async function listClasses(schoolYear?: string): Promise<ClassRow[]> {
  const year = schoolYear ?? (await currentSchoolYear());
  if (!year) return [];
  const rows = await db.classes.where('schoolYear').equals(year).toArray();
  return rows.filter((c) => isLive(c)).sort((a, b) => byName(a.name, b.name));
}

/** Always 5 groups (grades 1–5), each with its classes and student counts. */
export async function listClassesByGrade(schoolYear?: string): Promise<GradeGroup[]> {
  const classes = await listClasses(schoolYear);
  const counts = new Map<string, number>();
  const ids = classes.map((c) => c.id);
  if (ids.length) {
    await db.students
      .where('classId')
      .anyOf(ids)
      .each((s) => {
        if (isLive(s) && !s.archived) counts.set(s.classId, (counts.get(s.classId) ?? 0) + 1);
      });
  }
  return GRADES.map((grade) => ({
    grade,
    classes: classes.filter((c) => c.grade === grade).map((c) => ({ ...c, studentCount: counts.get(c.id) ?? 0 })),
  }));
}

export async function getClass(id: string): Promise<ClassRow | undefined> {
  const c = await db.classes.get(id);
  return isLive(c) ? c : undefined;
}

/** Find a live class by (typed) name in a school year (default: current). "3a" matches "3A". */
export async function findClassByName(name: string, schoolYear?: string): Promise<ClassRow | undefined> {
  const n = normalizeClassName(name);
  return (await listClasses(schoolYear)).find((c) => c.name === n);
}

/** Most recently used classes ("Lớp vừa dạy"). */
export async function recentClasses(limit = 3, schoolYear?: string): Promise<ClassRow[]> {
  return (await listClasses(schoolYear))
    .filter((c) => c.lastUsedAt !== null)
    .sort((a, b) => b.lastUsedAt! - a.lastUsedAt!)
    .slice(0, limit);
}

export async function createClass(input: { name: string; schoolYear?: string; grade?: Grade }, now = Date.now()): Promise<ClassRow> {
  const name = normalizeClassName(input.name);
  const grade = input.grade ?? gradeFromClassName(name);
  if (grade === null) throw new Error(`Không suy ra được khối từ tên lớp "${input.name}"`);
  const row = await buildRow(classSchema, { name, grade, schoolYear: input.schoolYear ?? schoolYearFor(now), lastUsedAt: null }, now);
  await db.classes.add(row);
  return row;
}

/** Rename a class; grade follows the new name unless it can't be derived. */
export async function renameClass(id: string, name: string, now = Date.now()): Promise<ClassRow> {
  const n = normalizeClassName(name);
  const grade = gradeFromClassName(n);
  return patchRow(db.classes, classSchema, id, grade === null ? { name: n } : { name: n, grade }, now);
}

export async function markClassUsed(id: string, now = Date.now()): Promise<void> {
  await patchRow(db.classes, classSchema, id, { lastUsedAt: now }, now);
}

/** Soft-delete a class and its students. */
export async function deleteClass(id: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.classes, db.students, async () => {
    await softDelete(db.classes, id, now);
    const students = await db.students.where('classId').equals(id).toArray();
    for (const s of students) await softDelete(db.students, s.id, now);
  });
}

/** True when there is no live class (first run → welcome screen). */
export async function isEmpty(): Promise<boolean> {
  return (await db.classes.filter((c) => isLive(c)).first()) === undefined;
}

// ---------------------------------------------------------------------------
// Bulk import / promotion
// ---------------------------------------------------------------------------

export interface ImportRosterResult {
  classIds: string[];
  classCount: number;
  studentCount: number;
}

/**
 * Save a previewed roster (SPEC 3.1). Creates classes (grade + school year derived)
 * and students with generated display names. If a live class with the same name and
 * school year exists, students are appended to it and its display names recomputed.
 * Throws (without writing) if a class has no name or no derivable grade.
 */
export async function importRoster(roster: RosterResult, opts: { now?: number; schoolYear?: string } = {}): Promise<ImportRosterResult> {
  const now = opts.now ?? Date.now();
  const schoolYear = opts.schoolYear ?? schoolYearFor(now);
  for (const c of roster.classes) {
    const name = normalizeClassName(c.name);
    if (!name) throw new Error('Có lớp chưa có tên');
    if ((c.grade ?? gradeFromClassName(name)) === null) throw new Error(`Không suy ra được khối từ tên lớp "${c.name}"`);
  }
  const ownerId = await getLocalOwnerId();

  return db.transaction('rw', db.classes, db.students, async () => {
    const classIds: string[] = [];
    let studentCount = 0;
    const existing = (await db.classes.where('schoolYear').equals(schoolYear).toArray()).filter((c) => isLive(c));
    for (const rc of roster.classes) {
      const name = normalizeClassName(rc.name);
      let cls = existing.find((c) => c.name === name);
      if (!cls) {
        cls = await buildRow(classSchema, { name, grade: (rc.grade ?? gradeFromClassName(name))!, schoolYear, lastUsedAt: null }, now, ownerId);
        await db.classes.add(cls);
        existing.push(cls);
      }
      const current = (await db.students.where('classId').equals(cls.id).toArray()).filter((s) => isLive(s));
      const offset = Math.max(0, ...current.map((s) => s.order));
      const added: StudentRow[] = [];
      for (const st of rc.students) {
        added.push(
          await buildRow(studentSchema, { classId: cls.id, order: offset + st.order, fullName: st.fullName, displayName: st.fullName, archived: false }, now, ownerId),
        );
      }
      const all = [...current, ...added];
      const shown = all.filter((s) => !s.archived);
      const names = displayNames(shown.map((s) => s.fullName));
      const nameById = new Map(shown.map((s, i) => [s.id, names[i]!]));
      const toSave = all
        .map((s) => {
          const displayName = nameById.get(s.id) ?? s.displayName;
          const isNew = added.includes(s);
          if (!isNew && displayName === s.displayName) return null;
          return studentSchema.parse({ ...s, displayName, updatedAt: isNew ? s.updatedAt : Math.max(now, s.updatedAt) });
        })
        .filter((s): s is StudentRow => s !== null);
      await db.students.bulkPut(toSave);
      classIds.push(cls.id);
      studentCount += added.length;
    }
    return { classIds, classCount: classIds.length, studentCount };
  });
}

export interface PromoteResult {
  fromYear: string;
  toYear: string;
  /** Classes created in the new year. */
  created: number;
  /** Grade-5 classes that graduate (not copied). */
  graduated: number;
  /** Classes skipped because the promoted class already exists. */
  skipped: number;
}

/**
 * "Lên lớp năm mới" (SPEC 3.1): copy each class of the current school year to the
 * next one with grade + 1 (3A → 4A), keeping its non-archived students (new rows,
 * same names/order/display names). Grade 5 graduates. Old classes and history stay.
 * Idempotent: classes already present in the new year are skipped.
 */
export async function promoteSchoolYear(now = Date.now()): Promise<PromoteResult> {
  const fromYear = await currentSchoolYear();
  if (!fromYear) throw new Error('Chưa có lớp nào để lên lớp');
  const toYear = nextSchoolYear(fromYear);
  const ownerId = await getLocalOwnerId();
  return db.transaction('rw', db.classes, db.students, async () => {
    const all = (await db.classes.where('schoolYear').anyOf(fromYear, toYear).toArray()).filter((c) => isLive(c));
    const oldClasses = all.filter((c) => c.schoolYear === fromYear);
    const newNames = new Set(all.filter((c) => c.schoolYear === toYear).map((c) => c.name));
    const res: PromoteResult = { fromYear, toYear, created: 0, graduated: 0, skipped: 0 };
    for (const c of oldClasses) {
      const name = promoteClassName(c.name);
      if (name === null) {
        res.graduated++;
        continue;
      }
      if (newNames.has(name)) {
        res.skipped++;
        continue;
      }
      const cls = await buildRow(classSchema, { name, grade: (c.grade + 1) as Grade, schoolYear: toYear, lastUsedAt: null }, now, ownerId);
      await db.classes.add(cls);
      newNames.add(name);
      const students = (await db.students.where('classId').equals(c.id).toArray()).filter((s) => isLive(s) && !s.archived);
      const copies: StudentRow[] = [];
      for (const s of students) {
        copies.push(await buildRow(studentSchema, { classId: cls.id, order: s.order, fullName: s.fullName, displayName: s.displayName, archived: false }, now, ownerId));
      }
      await db.students.bulkAdd(copies);
      res.created++;
    }
    return res;
  });
}

