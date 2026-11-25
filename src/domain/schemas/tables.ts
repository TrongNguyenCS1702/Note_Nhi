import { z } from 'zod';
import { dateKeySchema, epochMs, idSchema, schoolYearSchema, syncFields } from './common';

// ---------------------------------------------------------------------------
// Syncable tables (SPEC 5.2). All carry id, ownerId, createdAt, updatedAt, deletedAt?.
// ---------------------------------------------------------------------------

export const gradeSchema = z.number().int().min(1).max(5);
export type Grade = 1 | 2 | 3 | 4 | 5;

export const classSchema = z.object({
  ...syncFields,
  name: z.string().trim().min(1).max(20),
  grade: gradeSchema,
  schoolYear: schoolYearSchema,
  /** Last time the class was opened for a lesson (null = never). */
  lastUsedAt: epochMs.nullable(),
});
export type ClassRow = z.infer<typeof classSchema>;

export const studentSchema = z.object({
  ...syncFields,
  classId: idSchema,
  /** Ordinal from the roster; used only for sorting, never shown. */
  order: z.number().int().nonnegative(),
  fullName: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(60),
  archived: z.boolean(),
});
export type StudentRow = z.infer<typeof studentSchema>;

export const sessionSchema = z.object({
  ...syncFields,
  classId: idSchema,
  date: dateKeySchema,
  startedAt: epochMs,
  attendanceConfirmedAt: epochMs.optional(),
});
export type SessionRow = z.infer<typeof sessionSchema>;

export const scheduleSlotSchema = z.object({
  ...syncFields,
  /** 1 = Thứ hai (Monday) … 7 = Chủ nhật (Sunday). */
  weekday: z.number().int().min(1).max(7),
  /** Minutes since local midnight. */
  startMin: z.number().int().min(0).max(1439),
  classId: idSchema,
});
export type ScheduleSlotRow = z.infer<typeof scheduleSlotSchema>;

export const attendanceSchema = z.object({
  ...syncFields,
  sessionId: idSchema,
  studentId: idSchema,
  status: z.literal('absent'),
});
export type AttendanceRow = z.infer<typeof attendanceSchema>;

export const callMethodSchema = z.enum(['chase', 'spot', 'ball', 'claw']);
export type CallMethod = z.infer<typeof callMethodSchema>;

export const callStatusSchema = z.enum(['called', 'skipped', 'absent']);
export type CallStatus = z.infer<typeof callStatusSchema>;

export const callLogSchema = z.object({
  ...syncFields,
  sessionId: idSchema,
  classId: idSchema,
  studentId: idSchema,
  /** Game that made the call, e.g. 'chairs'. */
  game: z.string().min(1).max(40),
  method: callMethodSchema,
  status: callStatusSchema,
  at: epochMs,
});
export type CallLogRow = z.infer<typeof callLogSchema>;

export const funChallengeSchema = z.object({
  ...syncFields,
  text: z.string().trim().min(1).max(200),
  order: z.number().int().nonnegative(),
});
export type FunChallengeRow = z.infer<typeof funChallengeSchema>;

export const silenceDifficultySchema = z.enum(['easy', 'medium', 'hard']);
/** Dễ / Vừa / Khó. */
export type SilenceDifficulty = z.infer<typeof silenceDifficultySchema>;

export const silenceDurationSchema = z.union([z.literal(30), z.literal(60), z.literal(120)]);
export type SilenceDurationSec = z.infer<typeof silenceDurationSchema>;

export const userPrefsSchema = z.object({
  ...syncFields,
  waitMessage: z.string().max(60),
  waitDurationSec: z.number().int().min(1).max(3600),
  silenceDurationSec: silenceDurationSchema,
  silenceDifficulty: silenceDifficultySchema,
});
export type UserPrefsRow = z.infer<typeof userPrefsSchema>;

export const trackMoodSchema = z.enum(['calm', 'lively']);
export type TrackMood = z.infer<typeof trackMoodSchema>;

export const trackMetaSchema = z.object({
  ...syncFields,
  title: z.string().trim().min(1).max(200),
  mood: trackMoodSchema,
  mimeType: z.string().min(1),
  /** 0 when unknown. */
  durationSec: z.number().nonnegative(),
  /** Id of the TrackFile holding the audio blob. */
  fileId: idSchema,
});
export type TrackMetaRow = z.infer<typeof trackMetaSchema>;

// ---------------------------------------------------------------------------
// Device-local tables (never synced).
// ---------------------------------------------------------------------------

export const trackFileSchema = z.object({
  id: idSchema,
  blob: z.instanceof(Blob),
});
export type TrackFileRow = z.infer<typeof trackFileSchema>;

export const DEVICE_PREFS_ID = 'device';
export const devicePrefsSchema = z.object({
  id: z.literal(DEVICE_PREFS_ID),
  /** Master volume 0–1. */
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  tvSafeMargin: z.boolean(),
  micDeviceId: z.string().nullable(),
});
export type DevicePrefsRow = z.infer<typeof devicePrefsSchema>;

export const errorLogSchema = z.object({
  id: idSchema,
  at: epochMs,
  screen: z.string().max(100),
  message: z.string().max(2000),
  stack: z.string().max(20000).optional(),
});
export type ErrorLogRow = z.infer<typeof errorLogSchema>;

export const metaKeySchema = z.enum([
  'schemaVersion',
  'localOwnerId',
  'onboardedAt',
  'tvCheckDoneAt',
  'lastBackupAt',
  'backupDirHandle',
  'backupReminderAt',
]);
export type MetaKey = z.infer<typeof metaKeySchema>;

export const metaSchema = z.object({
  key: metaKeySchema,
  value: z.unknown(),
});
export type MetaRow = z.infer<typeof metaSchema>;
