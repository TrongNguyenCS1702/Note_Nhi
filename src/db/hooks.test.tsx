import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseRosterText } from '@/domain/roster';
import { db } from './db';
import { useClassesByGrade, useIsFirstRun, useRecentCallLogs, useStudents, useTodaySession, useUserPrefs } from './hooks';
import { getOrCreateTodaySession, importRoster, listStudents, logCall, setAbsent, updateUserPrefs } from './repositories';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('hooks', () => {
  it('react to writes (live queries)', async () => {
    const first = renderHook(() => useIsFirstRun());
    await waitFor(() => expect(first.result.current).toBe(true));

    const { classIds } = await importRoster(parseRosterText('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình'));
    const cid = classIds[0]!;
    await waitFor(() => expect(first.result.current).toBe(false));

    const groups = renderHook(() => useClassesByGrade());
    await waitFor(() => expect(groups.result.current?.[2]?.classes[0]?.studentCount).toBe(2));

    const students = renderHook(() => useStudents(cid));
    await waitFor(() => expect(students.result.current?.map((s) => s.displayName)).toEqual(['An', 'Bình']));

    const today = renderHook(() => useTodaySession(cid));
    await waitFor(() => expect(today.result.current?.session).toBeNull());
    const s = await getOrCreateTodaySession(cid);
    const [an] = await listStudents(cid);
    await act(() => setAbsent(s.id, an!.id, true));
    await waitFor(() => expect([...(today.result.current?.absentIds ?? [])]).toEqual([an!.id]));

    const logs = renderHook(() => useRecentCallLogs(cid));
    await waitFor(() => expect(logs.result.current).toEqual([]));
    await act(async () => {
      await logCall({ sessionId: s.id, classId: cid, studentId: an!.id, method: 'chase' });
    });
    await waitFor(() => expect(logs.result.current).toHaveLength(1));

    const prefs = renderHook(() => useUserPrefs());
    await waitFor(() => expect(prefs.result.current?.silenceDifficulty).toBe('medium'));
    await act(async () => {
      await updateUserPrefs({ silenceDifficulty: 'easy' });
    });
    await waitFor(() => expect(prefs.result.current?.silenceDifficulty).toBe('easy'));
  });
});
