// @vitest-environment node
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseRosterText } from '@/domain/roster';
import { BackupFormatError, backupFileName, exportData, exportZip, importPackage, readPackage, wipeAll } from './backup';
import { db } from './db';
import { getLocalOwnerId, setOnboardedAt } from './meta';
import {
  absentStudentIds,
  addScheduleSlot,
  addTrack,
  getOrCreateTodaySession,
  getTrackBlob,
  importRoster,
  isEmpty,
  listClassesByGrade,
  listStudents,
  listTracks,
  logCall,
  seedDefaultFunChallenges,
  setAbsent,
  updateUserPrefs,
  deleteStudent,
} from './repositories';

const NOW = new Date(2026, 10, 25, 8, 5).getTime();

async function seed() {
  const { classIds } = await importRoster(parseRosterText('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLớp 4B\nLê Văn Cường'), { now: NOW });
  const cid = classIds[0]!;
  const [an, binh] = await listStudents(cid);
  const s = await getOrCreateTodaySession(cid, NOW);
  await setAbsent(s.id, binh!.id, true, NOW);
  await logCall({ sessionId: s.id, classId: cid, studentId: an!.id, method: 'spot' }, NOW);
  await addScheduleSlot({ weekday: 3, startMin: 480, classId: cid }, NOW);
  await seedDefaultFunChallenges(NOW);
  await updateUserPrefs({ silenceDifficulty: 'hard' }, NOW);
  await deleteStudent(binh!.id, NOW + 1);
  const track = await addTrack({ blob: new Blob([new Uint8Array([7, 8, 9, 10])], { type: 'audio/mpeg' }), filename: 'Trống cơm.mp3', mood: 'lively' }, NOW);
  await setOnboardedAt(NOW);
  return { cid, sessionId: s.id, binhId: binh!.id, track };
}

const snapshot = async () => ({
  classes: await db.classes.toArray(),
  students: await db.students.toArray(),
  sessions: await db.sessions.toArray(),
  attendance: await db.attendance.toArray(),
  callLogs: await db.callLogs.toArray(),
  scheduleSlots: await db.scheduleSlots.toArray(),
  funChallenges: await db.funChallenges.toArray(),
  userPrefs: await db.userPrefs.toArray(),
  tracks: await db.tracks.toArray(),
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('backup', () => {
  it('export → wipe → import round trip restores everything incl. owner and music', async () => {
    const { sessionId, binhId, track } = await seed();
    const owner = await getLocalOwnerId();
    const before = await snapshot();
    const zip = await exportZip({ includeMusic: true, now: NOW });

    await wipeAll();
    expect(await isEmpty()).toBe(true);
    expect(await db.meta.count()).toBe(0);

    const summary = await importPackage(zip);
    expect(summary).toEqual({ format: 'note-nhi-backup', classes: 2, students: 2, tracks: 1, missingMusic: 0 });
    expect(await snapshot()).toEqual(before);
    expect(await getLocalOwnerId()).toBe(owner);
    expect([...(await absentStudentIds(sessionId))]).toEqual([binhId]);
    expect((await db.students.get(binhId))?.deletedAt).toBe(NOW + 1); // soft deletes survive
    const blob = await getTrackBlob(track.fileId);
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([7, 8, 9, 10]);
    expect(blob!.type).toBe('audio/mpeg');
  });

  it('backup without music keeps audio already on the device', async () => {
    const { track } = await seed();
    const zip = await exportZip({ now: NOW });
    expect(Object.keys(unzipSync(zip))).toEqual(['data.json']);
    const summary = await importPackage(zip);
    expect(summary.missingMusic).toBe(0);
    expect(await getTrackBlob(track.fileId)).toBeDefined();
    await wipeAll();
    expect((await importPackage(zip)).missingMusic).toBe(1);
  });

  it('replace mode drops data that is not in the backup', async () => {
    await seed();
    const zip = await exportZip({ now: NOW });
    await importRoster(parseRosterText('Lớp 5C\nPhạm Văn Dũng'), { now: NOW });
    await importPackage(zip);
    const names = (await listClassesByGrade()).flatMap((g) => g.classes.map((c) => c.name));
    expect(names).toEqual(['3A', '4B']);
  });
});

describe('setup package', () => {
  it('excludes history, deleted rows and ownerId; always carries music', async () => {
    await seed();
    const zip = await exportZip({ format: 'note-nhi-setup', now: NOW });
    const files = unzipSync(zip);
    expect(Object.keys(files)).toEqual(['data.json', expect.stringMatching(/^music\/[0-9a-f-]+\.mp3$/)]);
    const data = JSON.parse(strFromU8(files['data.json']!));
    expect(data.format).toBe('note-nhi-setup');
    expect(data.ownerId).toBeUndefined();
    expect(data.tables.sessions).toEqual([]);
    expect(data.tables.attendance).toEqual([]);
    expect(data.tables.callLogs).toEqual([]);
    expect(data.tables.students).toHaveLength(2); // deleted Bình is not shipped
    expect(JSON.stringify(data.tables)).not.toContain('ownerId');
  });

  it('import re-assigns ownerId to the local owner (helper machine → teacher machine)', async () => {
    await seed();
    const helperOwner = await getLocalOwnerId();
    const zip = await exportZip({ format: 'note-nhi-setup', now: NOW });
    await wipeAll();
    const teacherOwner = await getLocalOwnerId();
    expect(teacherOwner).not.toBe(helperOwner);

    const summary = await importPackage(zip);
    expect(summary).toEqual({ format: 'note-nhi-setup', classes: 2, students: 2, tracks: 1, missingMusic: 0 });
    const s = await snapshot();
    const owners = new Set([...s.classes, ...s.students, ...s.scheduleSlots, ...s.funChallenges, ...s.userPrefs, ...s.tracks].map((r) => r.ownerId));
    expect([...owners]).toEqual([teacherOwner]);
    expect(s.sessions).toEqual([]);
    expect(await listTracks('lively')).toHaveLength(1);
    expect(await getLocalOwnerId()).toBe(teacherOwner);
  });
});

describe('validation', () => {
  it('rejects non-zip, missing data.json, bad json and invalid rows without writing', async () => {
    await expect(readPackage(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(BackupFormatError);
    await expect(readPackage(zipSync({ 'x.txt': strToU8('hi') }))).rejects.toThrow('data.json');
    await expect(readPackage(zipSync({ 'data.json': strToU8('{oops') }))).rejects.toThrow('hỏng');

    await seed();
    const good = await exportData({ now: NOW });
    const bad = structuredClone(good) as unknown as { tables: { classes: { grade: number }[] } };
    bad.tables.classes[1]!.grade = 9;
    const before = await snapshot();
    await expect(importPackage(zipSync({ 'data.json': strToU8(JSON.stringify(bad)) }))).rejects.toBeInstanceOf(BackupFormatError);
    expect(await snapshot()).toEqual(before);
  });

  it('import is transactional: a failing write rolls everything back', async () => {
    await seed();
    const zip = await exportZip({ now: NOW });
    const before = await snapshot();
    const orig = db.trackFiles.bulkPut.bind(db.trackFiles);
    db.trackFiles.bulkPut = (() => Promise.reject(new Error('disk full'))) as unknown as typeof db.trackFiles.bulkPut;
    try {
      await expect(importPackage(zip)).rejects.toThrow('disk full');
    } finally {
      db.trackFiles.bulkPut = orig;
    }
    expect(await snapshot()).toEqual(before);
  });

  it('file names', () => {
    expect(backupFileName('note-nhi-backup', NOW)).toBe('note-nhi-backup.zip');
    expect(backupFileName('note-nhi-setup', NOW)).toBe('note-nhi-2026-11-25.zip');
    expect(backupFileName('note-nhi-backup', NOW, { dated: true })).toBe('note-nhi-2026-11-25.zip');
  });
});
