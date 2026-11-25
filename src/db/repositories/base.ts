import type { Table } from 'dexie';
import { v7 as uuidv7 } from 'uuid';
import type { z } from 'zod';
import type { SyncFields } from '@/domain/schemas';
import { getLocalOwnerId } from '../meta';

export const newId = (): string => uuidv7();

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

/** Live (not soft-deleted) row. */
export const isLive = <T extends { deletedAt?: number | undefined }>(r: T | undefined): r is T => !!r && r.deletedAt === undefined;

/** Build + validate a new syncable row: assigns id (UUID v7), ownerId, createdAt, updatedAt. */
export async function buildRow<S extends z.ZodType<SyncFields>>(
  schema: S,
  fields: Omit<z.input<S>, keyof SyncFields>,
  now: number,
  ownerId?: string,
): Promise<z.output<S>> {
  const owner = ownerId ?? (await getLocalOwnerId());
  return schema.parse({ ...fields, id: newId(), ownerId: owner, createdAt: now, updatedAt: now });
}

/** Insert a new validated row and return it. */
export async function insertRow<S extends z.ZodType<SyncFields>>(
  table: Table<z.output<S>, string>,
  schema: S,
  fields: Omit<z.input<S>, keyof SyncFields>,
  now: number,
): Promise<z.output<S>> {
  const row = await buildRow(schema, fields, now);
  await table.add(row);
  return row;
}

/** Patch a live row, bump updatedAt, validate and save. Throws NotFoundError. */
export async function patchRow<T extends SyncFields>(
  table: Table<T, string>,
  schema: z.ZodType<T>,
  id: string,
  patch: Partial<Omit<T, keyof SyncFields>>,
  now: number,
): Promise<T> {
  const cur = await table.get(id);
  if (!isLive(cur)) throw new NotFoundError(table.name, id);
  const next = schema.parse({ ...cur, ...patch, updatedAt: Math.max(now, cur.updatedAt) });
  await table.put(next);
  return next;
}

/** Soft delete (sets deletedAt + updatedAt). No-op if missing or already deleted. */
export async function softDelete<T extends SyncFields>(table: Table<T, string>, id: string, now: number): Promise<void> {
  const cur = await table.get(id);
  if (!isLive(cur)) return;
  await table.put({ ...cur, deletedAt: now, updatedAt: Math.max(now, cur.updatedAt) });
}

/** Vietnamese-aware natural sort ("3A" < "3B" < "10A"). */
export const byName = (a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
