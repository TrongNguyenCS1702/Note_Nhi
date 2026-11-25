import { v7 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';
import { backupDataSchema, BACKUP_SCHEMA_VERSION, callLogSchema, classSchema, schoolYearSchema, studentSchema, userPrefsSchema } from '.';

const base = () => ({ id: uuid(), ownerId: uuid(), createdAt: 1, updatedAt: 2 });

describe('table schemas', () => {
  it('accepts a valid class and rejects bad grade / school year', () => {
    const ok = { ...base(), name: '3A', grade: 3, schoolYear: '2026-2027', lastUsedAt: null };
    expect(classSchema.parse(ok)).toEqual(ok);
    expect(classSchema.safeParse({ ...ok, grade: 6 }).success).toBe(false);
    expect(classSchema.safeParse({ ...ok, schoolYear: '2026-2028' }).success).toBe(false);
    expect(classSchema.safeParse({ ...ok, id: 'nope' }).success).toBe(false);
  });

  it('school year must be consecutive years', () => {
    expect(schoolYearSchema.safeParse('2026-2027').success).toBe(true);
    expect(schoolYearSchema.safeParse('2026-2026').success).toBe(false);
  });

  it('student requires classId and non-empty names', () => {
    const ok = { ...base(), classId: uuid(), order: 1, fullName: 'Nguyễn Văn An', displayName: 'An', archived: false };
    expect(studentSchema.safeParse(ok).success).toBe(true);
    expect(studentSchema.safeParse({ ...ok, fullName: '  ' }).success).toBe(false);
  });

  it('call log status and method are enums; deletedAt optional', () => {
    const ok = { ...base(), sessionId: uuid(), classId: uuid(), studentId: uuid(), game: 'chairs', method: 'claw', status: 'called', at: 5 };
    expect(callLogSchema.safeParse(ok).success).toBe(true);
    expect(callLogSchema.safeParse({ ...ok, deletedAt: 9 }).success).toBe(true);
    expect(callLogSchema.safeParse({ ...ok, status: 'gone' }).success).toBe(false);
    expect(callLogSchema.safeParse({ ...ok, method: 'wheel' }).success).toBe(false);
  });

  it('user prefs limits wait message to 60 chars', () => {
    const ok = { ...base(), waitMessage: 'Chuẩn bị sách vở nhé!', waitDurationSec: 120, silenceDurationSec: 30, silenceDifficulty: 'medium' };
    expect(userPrefsSchema.safeParse(ok).success).toBe(true);
    expect(userPrefsSchema.safeParse({ ...ok, waitMessage: 'x'.repeat(61) }).success).toBe(false);
    expect(userPrefsSchema.safeParse({ ...ok, silenceDurationSec: 45 }).success).toBe(false);
  });
});

describe('backup data schema', () => {
  const cls = { ...base(), name: '3A', grade: 3, schoolYear: '2026-2027', lastUsedAt: null };

  it('fills missing tables with []', () => {
    const d = backupDataSchema.parse({ format: 'note-nhi-backup', schemaVersion: 1, exportedAt: 1, ownerId: uuid(), tables: { classes: [cls] } });
    expect(d.tables.students).toEqual([]);
    expect(d.tables.classes).toHaveLength(1);
  });

  it('backup needs ownerId; setup does not and rows may omit ownerId', () => {
    expect(backupDataSchema.safeParse({ format: 'note-nhi-backup', schemaVersion: 1, exportedAt: 1, tables: {} }).success).toBe(false);
    const { ownerId: _o, ...noOwner } = cls;
    expect(backupDataSchema.safeParse({ format: 'note-nhi-setup', schemaVersion: 1, exportedAt: 1, tables: { classes: [noOwner] } }).success).toBe(true);
  });

  it('setup package may not contain history', () => {
    const log = { ...base(), sessionId: uuid(), classId: uuid(), studentId: uuid(), game: 'chairs', method: 'chase', status: 'called', at: 1 };
    expect(backupDataSchema.safeParse({ format: 'note-nhi-setup', schemaVersion: 1, exportedAt: 1, tables: { callLogs: [log] } }).success).toBe(false);
  });

  it('rejects newer schema versions and unknown formats', () => {
    expect(backupDataSchema.safeParse({ format: 'note-nhi-setup', schemaVersion: BACKUP_SCHEMA_VERSION + 1, exportedAt: 1, tables: {} }).success).toBe(false);
    expect(backupDataSchema.safeParse({ format: 'zip', schemaVersion: 1, exportedAt: 1, tables: {} }).success).toBe(false);
  });
});
