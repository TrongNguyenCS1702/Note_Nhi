import type { CallStatus } from './schemas/tables';

export const WEEK_MS = 7 * 24 * 3600 * 1000;

/** The subset of a CallLog the picker needs. */
export interface CallLogLike {
  studentId: string;
  status: CallStatus;
  at: number;
  deletedAt?: number | undefined;
}

export interface Pickable {
  id: string;
  archived?: boolean;
}

/** Latest `at` of a non-deleted 'called' log per student. */
export function lastCalledMap(callLogs: readonly CallLogLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of callLogs) {
    if (l.status !== 'called' || l.deletedAt !== undefined) continue;
    const prev = m.get(l.studentId);
    if (prev === undefined || l.at > prev) m.set(l.studentId, l.at);
  }
  return m;
}

/** Latest time the student was really called ('called' status only); null if never. */
export function lastCalledAt(studentId: string, callLogs: readonly CallLogLike[]): number | null {
  return lastCalledMap(callLogs).get(studentId) ?? null;
}

/** True if the student has a 'called' log within the last 7 days (the ✓ mark). */
export function calledWithinWeek(studentId: string, callLogs: readonly CallLogLike[], now: number): boolean {
  const t = lastCalledAt(studentId, callLogs);
  return t !== null && now - t < WEEK_MS;
}

/** Number of students in `students` not called within the last 7 days ("Chưa được gọi tuần này: N"). */
export function countNotCalledThisWeek(students: readonly Pickable[], callLogs: readonly CallLogLike[], now: number): number {
  const last = lastCalledMap(callLogs);
  return students.filter((s) => {
    const t = last.get(s.id);
    return t === undefined || now - t >= WEEK_MS;
  }).length;
}

export interface PickOptions<T extends Pickable> {
  /** Present students only (absent ones must already be removed). Archived ones are ignored. */
  students: readonly T[];
  /** Call logs of this class (any status; only 'called' counts). */
  callLogs: readonly CallLogLike[];
  /** 1 (solo) or 2 (duo). */
  count: number;
  /** Student ids to leave out (e.g. the one just skipped with R). */
  exclude?: readonly string[];
  now: number;
  /** Uniform random in [0, 1). */
  rng: () => number;
}

/**
 * Fair picker (SPEC 3.4): prefer students not called in the last 7 days, uniformly;
 * if everyone was called, pick uniformly among those with the oldest lastCalledAt.
 * Returns up to `count` distinct students (fewer if not enough are available).
 */
export function pickStudents<T extends Pickable>({ students, callLogs, count, exclude = [], now, rng }: PickOptions<T>): T[] {
  const last = lastCalledMap(callLogs);
  const excluded = new Set(exclude);
  const seen = new Set<string>();
  let pool = students.filter((s) => {
    if (s.archived || excluded.has(s.id) || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  const out: T[] = [];
  const lastOf = (s: T) => last.get(s.id) ?? Number.NEGATIVE_INFINITY;

  for (let k = 0; k < count && pool.length > 0; k++) {
    let cands = pool.filter((s) => now - lastOf(s) >= WEEK_MS);
    if (cands.length === 0) {
      const oldest = Math.min(...pool.map(lastOf));
      cands = pool.filter((s) => lastOf(s) === oldest);
    }
    const idx = Math.min(cands.length - 1, Math.max(0, Math.floor(rng() * cands.length)));
    const p = cands[idx]!;
    out.push(p);
    pool = pool.filter((s) => s.id !== p.id);
  }
  return out;
}
