import Dexie, { type Table } from 'dexie';
import type {
  AttendanceRow,
  CallLogRow,
  ClassRow,
  DevicePrefsRow,
  ErrorLogRow,
  FunChallengeRow,
  MetaRow,
  ScheduleSlotRow,
  SessionRow,
  StudentRow,
  TrackFileRow,
  TrackMetaRow,
  UserPrefsRow,
} from '@/domain/schemas';

export const DB_NAME = 'lop-nhac-vui';
export const DB_VERSION = 1;

/**
 * IndexedDB schema (SPEC 5.2). Syncable tables index `updatedAt` so a future
 * sync layer can pull "changed since". Bump DB_VERSION + add `.upgrade()` on change.
 */
export class LnvDatabase extends Dexie {
  classes!: Table<ClassRow, string>;
  students!: Table<StudentRow, string>;
  sessions!: Table<SessionRow, string>;
  scheduleSlots!: Table<ScheduleSlotRow, string>;
  attendance!: Table<AttendanceRow, string>;
  callLogs!: Table<CallLogRow, string>;
  funChallenges!: Table<FunChallengeRow, string>;
  userPrefs!: Table<UserPrefsRow, string>;
  tracks!: Table<TrackMetaRow, string>;
  trackFiles!: Table<TrackFileRow, string>;
  devicePrefs!: Table<DevicePrefsRow, string>;
  errorLogs!: Table<ErrorLogRow, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(DB_VERSION).stores({
      classes: 'id, updatedAt, schoolYear, grade',
      students: 'id, classId, updatedAt',
      sessions: 'id, [classId+date], startedAt, updatedAt',
      scheduleSlots: 'id, weekday, classId, updatedAt',
      attendance: 'id, sessionId, [sessionId+studentId], updatedAt',
      callLogs: 'id, [classId+studentId+at], [classId+at], sessionId, updatedAt',
      funChallenges: 'id, order, updatedAt',
      userPrefs: 'id, updatedAt',
      tracks: 'id, mood, fileId, updatedAt',
      trackFiles: 'id',
      devicePrefs: 'id',
      errorLogs: 'id, at',
      meta: 'key',
    });
  }
}

export const db = new LnvDatabase();

/** Tables that follow the sync conventions (id, ownerId, createdAt, updatedAt, deletedAt?). */
export const SYNC_TABLES = [
  'classes',
  'students',
  'sessions',
  'scheduleSlots',
  'attendance',
  'callLogs',
  'funChallenges',
  'userPrefs',
  'tracks',
] as const;
export type SyncTableName = (typeof SYNC_TABLES)[number];

/** Every table, for wipe / import transactions. */
export const allTables = () => db.tables;
