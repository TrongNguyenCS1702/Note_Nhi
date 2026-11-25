import { z } from 'zod';

/** Epoch milliseconds (UTC). */
export const epochMs = z.number().int().nonnegative();

/** Client-generated id (UUID v7 for new records). */
export const idSchema = z.uuid();

/** Local calendar day `YYYY-MM-DD` (device time zone). */
export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD');

/** School year like `2026-2027`. */
export const schoolYearSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Năm học phải có dạng 2026-2027')
  .refine((s) => Number(s.slice(5)) === Number(s.slice(0, 4)) + 1, 'Năm học phải là 2 năm liên tiếp');

/** Fields every syncable table carries (SPEC 5.1). */
export const syncFields = {
  id: idSchema,
  ownerId: idSchema,
  createdAt: epochMs,
  updatedAt: epochMs,
  deletedAt: epochMs.optional(),
};

export type SyncFields = {
  id: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | undefined;
};
