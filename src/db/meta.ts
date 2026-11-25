import { v7 as uuidv7 } from 'uuid';
import type { MetaKey } from '@/domain/schemas';
import { db } from './db';

export async function getMeta<T = unknown>(key: MetaKey): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: MetaKey, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function deleteMeta(key: MetaKey): Promise<void> {
  await db.meta.delete(key);
}

/**
 * The local "owner" UUID v7 (SPEC 5.1). Created on first use and kept in Meta.
 * Safe to call inside or outside a transaction that includes `db.meta`.
 */
export async function getLocalOwnerId(): Promise<string> {
  return db.transaction('rw', db.meta, async () => {
    const existing = await db.meta.get('localOwnerId');
    if (typeof existing?.value === 'string') return existing.value;
    const id = uuidv7();
    await db.meta.put({ key: 'localOwnerId', value: id });
    return id;
  });
}

export async function setLocalOwnerId(id: string): Promise<void> {
  await setMeta('localOwnerId', id);
}

// ---- typed helpers for common keys -----------------------------------------

export const getOnboardedAt = () => getMeta<number>('onboardedAt');
export const setOnboardedAt = (now = Date.now()) => setMeta('onboardedAt', now);

export const getTvCheckDoneAt = () => getMeta<number>('tvCheckDoneAt');
export const setTvCheckDoneAt = (now = Date.now()) => setMeta('tvCheckDoneAt', now);
export const clearTvCheckDone = () => deleteMeta('tvCheckDoneAt');

export const getLastBackupAt = () => getMeta<number>('lastBackupAt');
export const setLastBackupAt = (now = Date.now()) => setMeta('lastBackupAt', now);

/** Last time the "choose a backup folder" reminder was shown (every 14 days). */
export const getBackupReminderAt = () => getMeta<number>('backupReminderAt');
export const setBackupReminderAt = (now = Date.now()) => setMeta('backupReminderAt', now);

/** FileSystemDirectoryHandle for auto backup (structured-cloneable, stored as-is). */
export const getBackupDirHandle = () => getMeta<FileSystemDirectoryHandle>('backupDirHandle');
export const setBackupDirHandle = (handle: FileSystemDirectoryHandle) => setMeta('backupDirHandle', handle);
export const clearBackupDirHandle = () => deleteMeta('backupDirHandle');
