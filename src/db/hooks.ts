import { useLiveQuery } from 'dexie-react-hooks';
import type { UserPrefsValues } from '@/domain/defaults';
import type { CallLogRow, ClassRow, DevicePrefsRow, FunChallengeRow, ScheduleSlotRow, SessionRow, StudentRow, TrackMetaRow, TrackMood } from '@/domain/schemas';
import { WEEK_MS } from '@/domain/fairness';
import type { ClassSuggestion } from '@/domain/suggest';
import {
  absentStudentIds,
  callLogsForClassSince,
  getClass,
  getDevicePrefs,
  getTodaySession,
  getUserPrefs,
  isEmpty,
  listClassesByGrade,
  listFunChallenges,
  listScheduleSlots,
  listStudents,
  listTracks,
  recentClasses,
  suggestClassNow,
  type GradeGroup,
} from './repositories';

// All hooks return `undefined` while the first query is loading.

/** Home screen: 5 grade rows with classes and student counts. */
export function useClassesByGrade(schoolYear?: string): GradeGroup[] | undefined {
  return useLiveQuery(() => listClassesByGrade(schoolYear), [schoolYear]);
}

/** "Lớp vừa dạy" chips. */
export function useRecentClasses(limit = 3): ClassRow[] | undefined {
  return useLiveQuery(() => recentClasses(limit), [limit]);
}

export function useClass(classId: string | null | undefined): ClassRow | null | undefined {
  return useLiveQuery(async () => (classId ? ((await getClass(classId)) ?? null) : null), [classId]);
}

/** Non-archived students of a class in roster order. */
export function useStudents(classId: string | null | undefined, opts: { includeArchived?: boolean } = {}): StudentRow[] | undefined {
  const includeArchived = !!opts.includeArchived;
  return useLiveQuery(async () => (classId ? listStudents(classId, { includeArchived }) : []), [classId, includeArchived]);
}

export interface TodaySessionState {
  /** null when the class has no session today yet. */
  session: SessionRow | null;
  absentIds: Set<string>;
}

/** Today's session of a class and its absent set. `now` defaults to the time of the query. */
export function useTodaySession(classId: string | null | undefined, now?: number): TodaySessionState | undefined {
  return useLiveQuery(async () => {
    if (!classId) return { session: null, absentIds: new Set<string>() };
    const session = (await getTodaySession(classId, now ?? Date.now())) ?? null;
    const absentIds = session ? await absentStudentIds(session.id) : new Set<string>();
    return { session, absentIds };
  }, [classId, now]);
}

/** Call logs of a class in the last 7 days (for ✓ marks and the fairness picker). */
export function useRecentCallLogs(classId: string | null | undefined, now?: number): CallLogRow[] | undefined {
  return useLiveQuery(async () => (classId ? callLogsForClassSince(classId, (now ?? Date.now()) - WEEK_MS) : []), [classId, now]);
}

export function useUserPrefs(): UserPrefsValues | undefined {
  return useLiveQuery(() => getUserPrefs(), []);
}

export function useDevicePrefs(): DevicePrefsRow | undefined {
  return useLiveQuery(() => getDevicePrefs(), []);
}

export function useTracks(mood?: TrackMood): TrackMetaRow[] | undefined {
  return useLiveQuery(() => listTracks(mood), [mood]);
}

export function useFunChallenges(): FunChallengeRow[] | undefined {
  return useLiveQuery(() => listFunChallenges(), []);
}

export function useScheduleSlots(): ScheduleSlotRow[] | undefined {
  return useLiveQuery(() => listScheduleSlots(), []);
}

/** True when the device has no class yet (show the welcome / setup-package screen). */
export function useIsFirstRun(): boolean | undefined {
  return useLiveQuery(() => isEmpty(), []);
}

/** Suggested class for the home screen (timetable, then history), or null. */
export function useSuggestedClass(now?: number): ClassSuggestion | null | undefined {
  return useLiveQuery(() => suggestClassNow(now ?? Date.now()), [now]);
}
