import { trackFileSchema, trackMetaSchema, type TrackMetaRow, type TrackMood } from '@/domain/schemas';
import { cleanText } from '@/domain/text';
import { trackTitleFromFilename } from '@/domain/trackTitle';
import { db } from '../db';
import { getLocalOwnerId } from '../meta';
import { buildRow, byName, isLive, newId, patchRow, softDelete } from './base';

/** Live tracks (optionally of one mood) sorted by title. */
export async function listTracks(mood?: TrackMood): Promise<TrackMetaRow[]> {
  const rows = mood ? await db.tracks.where('mood').equals(mood).toArray() : await db.tracks.toArray();
  return rows.filter((r) => isLive(r)).sort((a, b) => byName(a.title, b.title));
}

export interface AddTrackInput {
  blob: Blob;
  /** Original file name; used for the title when `title` is not given. */
  filename: string;
  mood: TrackMood;
  title?: string;
  /** 0 / undefined when unknown. */
  durationSec?: number;
  /** Defaults to blob.type, then 'audio/mpeg'. */
  mimeType?: string;
}

/** Store the audio blob (TrackFile) and its metadata (TrackMeta) together. */
export async function addTrack(input: AddTrackInput, now = Date.now()): Promise<TrackMetaRow> {
  const ownerId = await getLocalOwnerId();
  const fileId = newId();
  const file = trackFileSchema.parse({ id: fileId, blob: input.blob });
  const meta = await buildRow(
    trackMetaSchema,
    {
      title: cleanText(input.title ?? '') || trackTitleFromFilename(input.filename),
      mood: input.mood,
      mimeType: input.mimeType || input.blob.type || 'audio/mpeg',
      durationSec: input.durationSec && Number.isFinite(input.durationSec) ? input.durationSec : 0,
      fileId,
    },
    now,
    ownerId,
  );
  await db.transaction('rw', db.tracks, db.trackFiles, async () => {
    await db.trackFiles.add(file);
    await db.tracks.add(meta);
  });
  return meta;
}

export async function getTrack(id: string): Promise<TrackMetaRow | undefined> {
  const t = await db.tracks.get(id);
  return isLive(t) ? t : undefined;
}

export async function getTrackBlob(fileId: string): Promise<Blob | undefined> {
  return (await db.trackFiles.get(fileId))?.blob;
}

export function renameTrack(id: string, title: string, now = Date.now()): Promise<TrackMetaRow> {
  return patchRow(db.tracks, trackMetaSchema, id, { title: cleanText(title) }, now);
}

export function setTrackMood(id: string, mood: TrackMood, now = Date.now()): Promise<TrackMetaRow> {
  return patchRow(db.tracks, trackMetaSchema, id, { mood }, now);
}

export function setTrackDuration(id: string, durationSec: number, now = Date.now()): Promise<TrackMetaRow> {
  return patchRow(db.tracks, trackMetaSchema, id, { durationSec }, now);
}

/** Soft-delete the metadata and free the blob (blobs are device-local). */
export async function deleteTrack(id: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.tracks, db.trackFiles, async () => {
    const t = await db.tracks.get(id);
    if (!t) return;
    await softDelete(db.tracks, id, now);
    await db.trackFiles.delete(t.fileId);
  });
}
