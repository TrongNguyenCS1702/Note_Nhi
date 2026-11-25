import { z } from 'zod';
import { epochMs, idSchema } from './common';
import {
  attendanceSchema,
  callLogSchema,
  classSchema,
  errorLogSchema,
  funChallengeSchema,
  scheduleSlotSchema,
  sessionSchema,
  studentSchema,
  trackMetaSchema,
  userPrefsSchema,
} from './tables';

/** Current data.json schema version (bump together with the Dexie version). */
export const BACKUP_SCHEMA_VERSION = 1;

export const backupFormatSchema = z.enum(['note-nhi-backup', 'note-nhi-setup']);
export type BackupFormat = z.infer<typeof backupFormatSchema>;

// In a setup package rows do not carry the helper's ownerId; it is re-assigned on import.
const portableOwner = { ownerId: idSchema.optional() };

export const backupTablesSchema = z.object({
  classes: z.array(classSchema.extend(portableOwner)).default([]),
  students: z.array(studentSchema.extend(portableOwner)).default([]),
  sessions: z.array(sessionSchema.extend(portableOwner)).default([]),
  scheduleSlots: z.array(scheduleSlotSchema.extend(portableOwner)).default([]),
  attendance: z.array(attendanceSchema.extend(portableOwner)).default([]),
  callLogs: z.array(callLogSchema.extend(portableOwner)).default([]),
  funChallenges: z.array(funChallengeSchema.extend(portableOwner)).default([]),
  userPrefs: z.array(userPrefsSchema.extend(portableOwner)).default([]),
  tracks: z.array(trackMetaSchema.extend(portableOwner)).default([]),
  errorLogs: z.array(errorLogSchema).default([]),
});
export type BackupTables = z.infer<typeof backupTablesSchema>;
export type BackupTableName = keyof BackupTables;

/** Tables that are history and never part of a setup package (SPEC 5.3). */
export const HISTORY_TABLES = ['sessions', 'attendance', 'callLogs', 'errorLogs'] as const satisfies readonly BackupTableName[];

export const backupDataSchema = z
  .object({
    format: backupFormatSchema,
    schemaVersion: z.number().int().min(1),
    exportedAt: epochMs,
    ownerId: idSchema.optional(),
    tables: backupTablesSchema,
  })
  .superRefine((d, ctx) => {
    if (d.schemaVersion > BACKUP_SCHEMA_VERSION) {
      ctx.addIssue({ code: 'custom', message: 'File được tạo từ phiên bản app mới hơn. Hãy cập nhật app.', path: ['schemaVersion'] });
    }
    if (d.format === 'note-nhi-backup' && !d.ownerId) {
      ctx.addIssue({ code: 'custom', message: 'File sao lưu thiếu ownerId', path: ['ownerId'] });
    }
    if (d.format === 'note-nhi-setup') {
      for (const t of HISTORY_TABLES) {
        if (d.tables[t].length > 0) {
          ctx.addIssue({ code: 'custom', message: `Gói cài đặt không được chứa ${t}`, path: ['tables', t] });
        }
      }
    }
  });
export type BackupData = z.infer<typeof backupDataSchema>;
