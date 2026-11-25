import { DEFAULT_FUN_CHALLENGES } from '@/domain/defaults';
import { funChallengeSchema, type FunChallengeRow } from '@/domain/schemas';
import { cleanText } from '@/domain/text';
import { db } from '../db';
import { getLocalOwnerId } from '../meta';
import { buildRow, insertRow, isLive, patchRow, softDelete } from './base';

export async function listFunChallenges(): Promise<FunChallengeRow[]> {
  const rows = await db.funChallenges.orderBy('order').toArray();
  return rows.filter((r) => isLive(r));
}

/** Texts for the "Thử thách vui" spinner; the defaults when none were ever saved. */
export async function funChallengeTexts(): Promise<string[]> {
  const live = await listFunChallenges();
  if (live.length) return live.map((r) => r.text);
  return (await db.funChallenges.count()) === 0 ? [...DEFAULT_FUN_CHALLENGES] : [];
}

/** Seed the default challenges if the table has never had any row. Returns true if seeded. */
export async function seedDefaultFunChallenges(now = Date.now()): Promise<boolean> {
  const ownerId = await getLocalOwnerId();
  return db.transaction('rw', db.funChallenges, async () => {
    if ((await db.funChallenges.count()) > 0) return false;
    const rows: FunChallengeRow[] = [];
    for (const [i, text] of DEFAULT_FUN_CHALLENGES.entries()) {
      rows.push(await buildRow(funChallengeSchema, { text, order: i + 1 }, now, ownerId));
    }
    await db.funChallenges.bulkAdd(rows);
    return true;
  });
}

export async function addFunChallenge(text: string, now = Date.now()): Promise<FunChallengeRow> {
  const order = Math.max(0, ...(await listFunChallenges()).map((r) => r.order)) + 1;
  return insertRow(db.funChallenges, funChallengeSchema, { text: cleanText(text), order }, now);
}

export function updateFunChallenge(id: string, text: string, now = Date.now()): Promise<FunChallengeRow> {
  return patchRow(db.funChallenges, funChallengeSchema, id, { text: cleanText(text) }, now);
}

export function deleteFunChallenge(id: string, now = Date.now()): Promise<void> {
  return softDelete(db.funChallenges, id, now);
}

/** Persist a new order (ids in display order). */
export async function reorderFunChallenges(ids: readonly string[], now = Date.now()): Promise<void> {
  await db.transaction('rw', db.funChallenges, async () => {
    for (const [i, id] of ids.entries()) await patchRow(db.funChallenges, funChallengeSchema, id, { order: i + 1 }, now);
  });
}
