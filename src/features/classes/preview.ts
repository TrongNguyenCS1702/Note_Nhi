import { gradeFromClassName, normalizeClassName } from '@/domain/classInfo';
import { displayNames } from '@/domain/displayNames';
import { describeIssue, rosterIssues, type RosterClass, type RosterIssue, type RosterResult } from '@/domain/roster';
import { cleanText } from '@/domain/text';

// Editable roster preview (SPEC 3.1 "Màn xem trước trước khi lưu"). Pure, immutable updates.

export function renameDraftClass(r: RosterResult, ci: number, name: string): RosterResult {
  return mapClass(r, ci, (c) => {
    const n = normalizeClassName(name);
    return { ...c, name: n, grade: n ? gradeFromClassName(n) : null };
  });
}

export function editDraftStudent(r: RosterResult, ci: number, si: number, fullName: string): RosterResult {
  return mapClass(r, ci, (c) => ({ ...c, students: c.students.map((s, i) => (i === si ? { ...s, fullName } : s)) }));
}

export function removeDraftStudent(r: RosterResult, ci: number, si: number): RosterResult {
  return mapClass(r, ci, (c) => ({ ...c, students: c.students.filter((_, i) => i !== si) }));
}

export function removeDraftClass(r: RosterResult, ci: number): RosterResult {
  return { ...r, classes: r.classes.filter((_, i) => i !== ci) };
}

function mapClass(r: RosterResult, ci: number, f: (c: RosterClass) => RosterClass): RosterResult {
  return { ...r, classes: r.classes.map((c, i) => (i === ci ? f(c) : c)) };
}

/** Names as they will be saved (trimmed, NFC); empty rows dropped. */
export function cleanedRoster(r: RosterResult): RosterResult {
  return {
    ...r,
    classes: r.classes
      .map((c) => ({ ...c, students: c.students.map((s) => ({ ...s, fullName: cleanText(s.fullName) })).filter((s) => s.fullName !== '') }))
      .filter((c) => c.students.length > 0),
  };
}

export interface ClassPreview {
  /** Display name per student (same index as `students`). */
  shown: string[];
  /** Class-level messages (no name, odd size…). */
  classIssues: string[];
  /** Student index → messages (one-word, duplicate). */
  studentIssues: Map<number, string[]>;
  /** Saving is impossible (no name / unknown grade). */
  blocking: boolean;
}

export function previewClass(c: RosterClass): ClassPreview {
  const issues = rosterIssues(c);
  const studentIssues = new Map<number, string[]>();
  const add = (i: number, msg: string) => studentIssues.set(i, [...(studentIssues.get(i) ?? []), msg]);
  const classIssues: string[] = [];
  for (const issue of issues) {
    if (issue.kind === 'oneWord') add(issue.studentIndex, 'Chỉ có 1 chữ');
    else if (issue.kind === 'duplicate') issue.studentIndexes.forEach((i) => add(i, 'Tên bị trùng'));
    else classIssues.push(describeIssue(issue));
  }
  return {
    shown: displayNames(c.students.map((s) => cleanText(s.fullName) || '?')),
    classIssues,
    studentIssues,
    blocking: issues.some((i: RosterIssue) => i.kind === 'noName' || i.kind === 'noGrade'),
  };
}

export const canConfirm = (r: RosterResult): boolean => r.classes.length > 0 && r.classes.every((c) => !previewClass(c).blocking);

export const draftTotals = (r: RosterResult) => ({ classes: r.classes.length, students: r.classes.reduce((n, c) => n + c.students.length, 0) });
