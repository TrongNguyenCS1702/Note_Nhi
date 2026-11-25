import { errorLogSchema, type ErrorLogRow } from '@/domain/schemas';
import { db } from '../db';
import { newId } from './base';

export const MAX_ERROR_LOGS = 200;

/** Record an error locally (never sent anywhere). Keeps the newest MAX_ERROR_LOGS entries. Never throws. */
export async function logError(input: { screen: string; message: string; stack?: string | undefined }, now = Date.now()): Promise<void> {
  try {
    const row = errorLogSchema.parse({
      id: newId(),
      at: now,
      screen: input.screen.slice(0, 100),
      message: input.message.slice(0, 2000),
      ...(input.stack ? { stack: input.stack.slice(0, 20000) } : {}),
    });
    await db.transaction('rw', db.errorLogs, async () => {
      await db.errorLogs.add(row);
      const count = await db.errorLogs.count();
      if (count > MAX_ERROR_LOGS) {
        const old = await db.errorLogs.orderBy('at').limit(count - MAX_ERROR_LOGS).primaryKeys();
        await db.errorLogs.bulkDelete(old);
      }
    });
  } catch {
    // logging must never break the error screen
  }
}

/** Newest first. */
export async function listErrors(): Promise<ErrorLogRow[]> {
  return db.errorLogs.orderBy('at').reverse().toArray();
}

export async function clearErrors(): Promise<void> {
  await db.errorLogs.clear();
}
