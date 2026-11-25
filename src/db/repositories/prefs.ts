import { DEFAULT_DEVICE_PREFS, DEFAULT_USER_PREFS, type UserPrefsValues } from '@/domain/defaults';
import { DEVICE_PREFS_ID, devicePrefsSchema, userPrefsSchema, type DevicePrefsRow, type UserPrefsRow } from '@/domain/schemas';
import { db } from '../db';
import { getLocalOwnerId } from '../meta';
import { buildRow, isLive } from './base';

async function liveUserPrefsRow(): Promise<UserPrefsRow | undefined> {
  const rows = (await db.userPrefs.toArray()).filter((r) => isLive(r));
  return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/** Remembered choices (wait screen + silence game); defaults when never saved. */
export async function getUserPrefs(): Promise<UserPrefsValues> {
  const row = await liveUserPrefsRow();
  if (!row) return { ...DEFAULT_USER_PREFS };
  const { waitMessage, waitDurationSec, silenceDurationSec, silenceDifficulty } = row;
  return { waitMessage, waitDurationSec, silenceDurationSec, silenceDifficulty };
}

/** Upsert the single UserPrefs row of this teacher. */
export async function updateUserPrefs(patch: Partial<UserPrefsValues>, now = Date.now()): Promise<UserPrefsValues> {
  const ownerId = await getLocalOwnerId();
  return db.transaction('rw', db.userPrefs, async () => {
    const cur = await liveUserPrefsRow();
    const row = cur
      ? userPrefsSchema.parse({ ...cur, ...patch, updatedAt: Math.max(now, cur.updatedAt) })
      : await buildRow(userPrefsSchema, { ...DEFAULT_USER_PREFS, ...patch }, now, ownerId);
    await db.userPrefs.put(row);
    const { waitMessage, waitDurationSec, silenceDurationSec, silenceDifficulty } = row;
    return { waitMessage, waitDurationSec, silenceDurationSec, silenceDifficulty };
  });
}

/** Device-local prefs (volume, mute, TV safe margin, mic); defaults when never saved. */
export async function getDevicePrefs(): Promise<DevicePrefsRow> {
  const row = await db.devicePrefs.get(DEVICE_PREFS_ID);
  return { ...DEFAULT_DEVICE_PREFS, ...row };
}

export async function updateDevicePrefs(patch: Partial<Omit<DevicePrefsRow, 'id'>>): Promise<DevicePrefsRow> {
  return db.transaction('rw', db.devicePrefs, async () => {
    const row = devicePrefsSchema.parse({ ...(await getDevicePrefs()), ...patch, id: DEVICE_PREFS_ID });
    await db.devicePrefs.put(row);
    return row;
  });
}
