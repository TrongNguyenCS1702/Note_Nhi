// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { pickStudents } from '@/domain/fairness';
import { parseRosterText } from '@/domain/roster';
import { db } from '../db';
import { getLocalOwnerId, getMeta, setOnboardedAt } from '../meta';
import {
  absentStudentIds,
  addFunChallenge,
  addScheduleSlot,
  addStudent,
  addTrack,
  callLogsForClassSince,
  confirmAttendance,
  createClass,
  deleteClass,
  deleteFunChallenge,
  deleteTrack,
  findClassByName,
  funChallengeTexts,
  getDevicePrefs,
  getOrCreateTodaySession,
  getTodaySession,
  getTrackBlob,
  getUserPrefs,
  importRoster,
  isEmpty,
  listClasses,
  listClassesByGrade,
  listErrors,
  listFunChallenges,
  listStudents,
  listTracks,
  logCall,
  logError,
  MAX_ERROR_LOGS,
  NotFoundError,
  promoteSchoolYear,
  recentCallLogs,
  recentClasses,
  recomputeDisplayNames,
  renameStudent,
  seedDefaultFunChallenges,
  setAbsent,
  setCallStatus,
  setStudentArchived,
  suggestClassNow,
  toggleAbsent,
  updateDevicePrefs,
  updateUserPrefs,
} from '.';

// Wednesday 25/11/2026 08:05 local
const NOW = new Date(2026, 10, 25, 8, 5).getTime();
const DAY = 24 * 3600 * 1000;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const roster = (text: string) => parseRosterText(text);

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('meta', () => {
  it('creates one stable UUID v7 owner id', async () => {
    const a = await getLocalOwnerId();
    const [b, c] = await Promise.all([getLocalOwnerId(), getLocalOwnerId()]);
    expect(a).toMatch(UUID_V7);
    expect(b).toBe(a);
    expect(c).toBe(a);
    await setOnboardedAt(NOW);
    expect(await getMeta('onboardedAt')).toBe(NOW);
  });
});

describe('classes & students', () => {
  it('isEmpty, create with derived grade/schoolYear and sync fields', async () => {
    expect(await isEmpty()).toBe(true);
    const c = await createClass({ name: 'lớp 3a' }, NOW);
    expect(c).toMatchObject({ name: '3A', grade: 3, schoolYear: '2026-2027', lastUsedAt: null, createdAt: NOW, updatedAt: NOW });
    expect(c.id).toMatch(UUID_V7);
    expect(c.ownerId).toBe(await getLocalOwnerId());
    expect(await isEmpty()).toBe(false);
    await expect(createClass({ name: '7A' }, NOW)).rejects.toThrow();
  });

  it('imports a multi-class roster with display names and groups by grade', async () => {
    const res = await importRoster(roster('Lớp 3A\nNguyễn Minh An\nLê Bảo An\nTrần Thị Bình\nLớp 5B\n1. Phạm Văn Cường\nLớp 3B\nVõ Thị Dung'), { now: NOW });
    expect(res).toMatchObject({ classCount: 3, studentCount: 5 });
    const groups = await listClassesByGrade();
    expect(groups.map((g) => g.grade)).toEqual([1, 2, 3, 4, 5]);
    expect(groups[2]!.classes.map((c) => [c.name, c.studentCount])).toEqual([
      ['3A', 3],
      ['3B', 1],
    ]);
    expect(groups[4]!.classes[0]!.name).toBe('5B');
    const a3 = (await findClassByName('3a'))!;
    expect((await listStudents(a3.id)).map((s) => s.displayName)).toEqual(['Minh An', 'Bảo An', 'Bình']);
  });

  it('import appends to an existing class and recomputes names', async () => {
    await importRoster(roster('Lớp 3A\nNguyễn Văn An'), { now: NOW });
    await importRoster(roster('Lớp 3A\nTrần Minh An'), { now: NOW + 1 });
    const c = (await findClassByName('3A'))!;
    const st = await listStudents(c.id);
    expect(st.map((s) => [s.order, s.displayName])).toEqual([
      [1, 'Văn An'],
      [2, 'Minh An'],
    ]);
    expect(await listClasses()).toHaveLength(1);
  });

  it('rejects a roster with an unnamed class without writing', async () => {
    await expect(importRoster(roster('Nguyễn Văn An'), { now: NOW })).rejects.toThrow();
    expect(await isEmpty()).toBe(true);
  });

  it('student edits: rename display name, archive, add, recompute', async () => {
    const { classIds } = await importRoster(roster('Lớp 4A\nNguyễn Văn An\nTrần Thị Bình'), { now: NOW });
    const cid = classIds[0]!;
    const [an] = await listStudents(cid);
    const renamed = await renameStudent(an!.id, '  Bé   An ', NOW + 5);
    expect(renamed.displayName).toBe('Bé An');
    expect(renamed.updatedAt).toBe(NOW + 5);
    await setStudentArchived(an!.id, true, NOW + 6);
    expect((await listStudents(cid)).map((s) => s.fullName)).toEqual(['Trần Thị Bình']);
    expect(await listStudents(cid, { includeArchived: true })).toHaveLength(2);
    const added = await addStudent(cid, 'Lê Văn Bình', NOW + 7);
    expect(added).toMatchObject({ order: 3, displayName: 'Văn Bình' });
    await recomputeDisplayNames(cid, NOW + 8);
    expect((await listStudents(cid)).map((s) => s.displayName)).toEqual(['Thị Bình', 'Văn Bình']);
    await expect(renameStudent('00000000-0000-7000-8000-000000000000', 'x')).rejects.toBeInstanceOf(NotFoundError);
    await expect(renameStudent(added.id, '   ')).rejects.toThrow();
  });

  it('soft-deletes classes and their students', async () => {
    const { classIds } = await importRoster(roster('Lớp 2A\nNguyễn Văn An'), { now: NOW });
    await deleteClass(classIds[0]!, NOW + 1);
    expect(await isEmpty()).toBe(true);
    const raw = await db.classes.get(classIds[0]!);
    expect(raw?.deletedAt).toBe(NOW + 1);
    expect((await db.students.toArray())[0]!.deletedAt).toBe(NOW + 1);
  });

  it('promotes a school year: grade+1, students copied, grade 5 graduates, idempotent', async () => {
    await importRoster(roster('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLớp 5A\nLê Văn Cường'), { now: NOW });
    const a3 = (await findClassByName('3A'))!;
    const [an] = await listStudents(a3.id);
    await renameStudent(an!.id, 'Bé An', NOW);
    const res = await promoteSchoolYear(NOW + DAY);
    expect(res).toEqual({ fromYear: '2026-2027', toYear: '2027-2028', created: 1, graduated: 1, skipped: 0 });
    expect((await listClasses()).map((c) => [c.name, c.grade, c.schoolYear])).toEqual([['4A', 4, '2027-2028']]);
    expect((await listClasses('2026-2027')).map((c) => c.name)).toEqual(['3A', '5A']);
    const a4 = (await findClassByName('4A'))!;
    expect((await listStudents(a4.id)).map((s) => s.displayName)).toEqual(['Bé An', 'Bình']);
    expect((await promoteSchoolYear(NOW + 2 * DAY)).fromYear).toBe('2027-2028'); // now promotes 4A → 5A
  });
});

describe('sessions & attendance', () => {
  it('get/create today session once per day, marks class used', async () => {
    const c = await createClass({ name: '3A' }, NOW);
    expect(await getTodaySession(c.id, NOW)).toBeUndefined();
    const s1 = await getOrCreateTodaySession(c.id, NOW);
    expect(s1).toMatchObject({ classId: c.id, date: '2026-11-25', startedAt: NOW });
    const s2 = await getOrCreateTodaySession(c.id, NOW + 3600e3);
    expect(s2.id).toBe(s1.id);
    const s3 = await getOrCreateTodaySession(c.id, NOW + DAY);
    expect(s3.id).not.toBe(s1.id);
    expect((await recentClasses())[0]!.lastUsedAt).toBe(NOW + DAY);
  });

  it('set / clear / toggle absent and confirm attendance', async () => {
    const { classIds } = await importRoster(roster('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình'), { now: NOW });
    const [an, binh] = await listStudents(classIds[0]!);
    const s = await getOrCreateTodaySession(classIds[0]!, NOW);
    await setAbsent(s.id, an!.id, true, NOW);
    await setAbsent(s.id, an!.id, true, NOW); // idempotent
    expect([...(await absentStudentIds(s.id))]).toEqual([an!.id]);
    await setAbsent(s.id, an!.id, false, NOW + 1);
    expect((await absentStudentIds(s.id)).size).toBe(0);
    expect(await toggleAbsent(s.id, an!.id, NOW + 2)).toBe(true); // revives the same row
    expect(await toggleAbsent(s.id, binh!.id, NOW + 2)).toBe(true);
    expect(await db.attendance.count()).toBe(2);
    expect((await absentStudentIds(s.id)).size).toBe(2);
    const confirmed = await confirmAttendance(s.id, NOW + 3);
    expect(confirmed.attendanceConfirmedAt).toBe(NOW + 3);
    expect((await getTodaySession(classIds[0]!, NOW + 10))!.attendanceConfirmedAt).toBe(NOW + 3);
  });
});

describe('call logs', () => {
  it('log, update status, query since; integrates with the picker', async () => {
    const { classIds } = await importRoster(roster('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLê Văn Cường'), { now: NOW });
    const cid = classIds[0]!;
    const students = await listStudents(cid);
    const s = await getOrCreateTodaySession(cid, NOW);
    const old = await logCall({ sessionId: s.id, classId: cid, studentId: students[0]!.id, method: 'chase' }, NOW - 8 * DAY);
    const id1 = await logCall({ sessionId: s.id, classId: cid, studentId: students[0]!.id, method: 'claw' }, NOW - DAY);
    const id2 = await logCall({ sessionId: s.id, classId: cid, studentId: students[1]!.id, method: 'ball' }, NOW);
    expect(id1).toMatch(UUID_V7);
    await setCallStatus(id2, 'skipped', NOW + 1);
    const recent = await recentCallLogs(cid, NOW);
    expect(recent.map((l) => l.id)).toEqual([id1, id2]);
    expect(recent[1]!.status).toBe('skipped');
    expect((await callLogsForClassSince(cid, 0)).map((l) => l.id)).toContain(old);
    // An was called yesterday; Bình's call was skipped → picker never picks An while others remain
    for (let r = 0; r < 1; r += 0.25) {
      const [p] = pickStudents({ students, callLogs: recent, count: 1, now: NOW, rng: () => r });
      expect(p!.id).not.toBe(students[0]!.id);
    }
  });
});

describe('schedule & suggestion', () => {
  it('suggests by timetable, then by history', async () => {
    const a = await createClass({ name: '3A' }, NOW);
    const b = await createClass({ name: '4B' }, NOW);
    expect(await suggestClassNow(NOW)).toBeNull();
    await getOrCreateTodaySession(b.id, NOW - 7 * DAY);
    expect(await suggestClassNow(NOW)).toEqual({ classId: b.id, reason: 'history' });
    await addScheduleSlot({ weekday: 3, startMin: 8 * 60, classId: a.id }, NOW);
    expect(await suggestClassNow(NOW)).toMatchObject({ classId: a.id, reason: 'timetable' });
  });
});

describe('fun challenges & prefs', () => {
  it('defaults until seeded; seeding happens once', async () => {
    expect(await funChallengeTexts()).toHaveLength(6);
    expect(await seedDefaultFunChallenges(NOW)).toBe(true);
    expect(await seedDefaultFunChallenges(NOW)).toBe(false);
    const list = await listFunChallenges();
    expect(list.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6]);
    await addFunChallenge('Hát to 1 câu', NOW);
    await deleteFunChallenge(list[0]!.id, NOW);
    const texts = await funChallengeTexts();
    expect(texts).toHaveLength(6);
    expect(texts.at(-1)).toBe('Hát to 1 câu');
    for (const c of await listFunChallenges()) await deleteFunChallenge(c.id, NOW);
    expect(await funChallengeTexts()).toEqual([]); // user removed all: do not resurrect defaults
  });

  it('user prefs upsert one row; device prefs merge defaults', async () => {
    expect(await getUserPrefs()).toEqual({ waitMessage: 'Chuẩn bị sách vở nhé!', waitDurationSec: 120, silenceDurationSec: 30, silenceDifficulty: 'medium' });
    await updateUserPrefs({ silenceDifficulty: 'hard' }, NOW);
    await updateUserPrefs({ silenceDurationSec: 60 }, NOW + 1);
    expect(await getUserPrefs()).toMatchObject({ silenceDifficulty: 'hard', silenceDurationSec: 60 });
    expect(await db.userPrefs.count()).toBe(1);
    await expect(updateUserPrefs({ waitMessage: 'x'.repeat(61) })).rejects.toThrow();
    expect(await getDevicePrefs()).toMatchObject({ volume: 0.7, muted: false, tvSafeMargin: false, micDeviceId: null });
    await updateDevicePrefs({ tvSafeMargin: true });
    expect((await getDevicePrefs()).tvSafeMargin).toBe(true);
    await expect(updateDevicePrefs({ volume: 2 })).rejects.toThrow();
  });
});

describe('tracks', () => {
  it('stores blob + meta, lists by mood, deletes both', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' });
    const t = await addTrack({ blob, filename: '01 - Trống_cơm.mp3', mood: 'lively', durationSec: 95 }, NOW);
    expect(t).toMatchObject({ title: 'Trống cơm', mood: 'lively', mimeType: 'audio/mpeg', durationSec: 95 });
    await addTrack({ blob, filename: 'b.mp3', title: 'Bèo dạt mây trôi', mood: 'calm' }, NOW);
    expect((await listTracks('lively')).map((x) => x.title)).toEqual(['Trống cơm']);
    expect(await listTracks()).toHaveLength(2);
    const got = await getTrackBlob(t.fileId);
    expect(got?.size).toBe(3);
    await deleteTrack(t.id, NOW);
    expect(await listTracks('lively')).toEqual([]);
    expect(await getTrackBlob(t.fileId)).toBeUndefined();
  });
});

describe('error log', () => {
  it('logs, caps and never throws', async () => {
    await logError({ screen: 'chairs', message: 'boom', stack: 'at x' }, NOW);
    expect((await listErrors())[0]).toMatchObject({ screen: 'chairs', message: 'boom' });
    for (let i = 0; i < MAX_ERROR_LOGS + 5; i++) await db.errorLogs.add({ id: crypto.randomUUID(), at: i, screen: 's', message: 'm' });
    await logError({ screen: 's', message: 'x'.repeat(5000) }, NOW + 1);
    expect(await db.errorLogs.count()).toBe(MAX_ERROR_LOGS);
    expect((await listErrors())[0]!.message).toHaveLength(2000);
  });
});
