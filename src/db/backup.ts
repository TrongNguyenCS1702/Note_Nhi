import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { localDateKey } from '@/domain/time';
import {
  BACKUP_SCHEMA_VERSION,
  backupDataSchema,
  HISTORY_TABLES,
  type BackupData,
  type BackupFormat,
  type BackupTableName,
  type BackupTables,
  type TrackMetaRow,
} from '@/domain/schemas';
import { db, SYNC_TABLES } from './db';
import { getLocalOwnerId, setLocalOwnerId } from './meta';
import { isLive } from './repositories/base';

export const DATA_FILE = 'data.json';
export const MUSIC_DIR = 'music/';

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
};

export const extForMime = (mime: string): string => EXT_BY_MIME[mime.toLowerCase().split(';')[0]!.trim()] ?? 'bin';

/** Path of a track's audio inside the zip. */
export const musicPath = (t: Pick<TrackMetaRow, 'fileId' | 'mimeType'>) => `${MUSIC_DIR}${t.fileId}.${extForMime(t.mimeType)}`;

/** 'lop-nhac-vui-backup.zip' (auto backup) or 'lop-nhac-vui-<YYYY-MM-DD>.zip' (setup package / manual export). */
export function backupFileName(format: BackupFormat, now = Date.now(), opts: { dated?: boolean } = {}): string {
  if (format === 'lnv-backup' && !opts.dated) return 'lop-nhac-vui-backup.zip';
  return `lop-nhac-vui-${localDateKey(now)}.zip`;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** 'lnv-backup' (default): everything incl. history and soft-deleted rows.
   *  'lnv-setup': live rows only, no history, no ownerId. */
  format?: BackupFormat;
  /** Include music files. Default: true for setup packages, false for backups. */
  includeMusic?: boolean;
  now?: number;
}

/** Build the data.json payload (SPEC 5.3). */
export async function exportData(opts: ExportOptions = {}): Promise<BackupData> {
  const format = opts.format ?? 'lnv-backup';
  const now = opts.now ?? Date.now();
  const setup = format === 'lnv-setup';
  const history = new Set<string>(HISTORY_TABLES);

  const tables = await db.transaction('r', db.tables, async () => {
    const out: Record<string, unknown[]> = {};
    for (const name of SYNC_TABLES) {
      if (setup && history.has(name)) continue;
      let rows: Record<string, unknown>[] = await db.table(name).toArray();
      if (setup) rows = rows.filter((r) => r.deletedAt === undefined).map(({ ownerId: _o, ...rest }) => rest);
      out[name] = rows;
    }
    out.errorLogs = setup ? [] : await db.errorLogs.toArray();
    return out;
  });

  const data = {
    format,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    ...(setup ? {} : { ownerId: await getLocalOwnerId() }),
    tables,
  };
  return backupDataSchema.parse(data);
}

/** Build the .zip (data.json + optional music/<fileId>.<ext>). */
export async function exportZip(opts: ExportOptions = {}): Promise<Uint8Array> {
  const format = opts.format ?? 'lnv-backup';
  const includeMusic = opts.includeMusic ?? format === 'lnv-setup';
  const data = await exportData({ ...opts, format });
  const files: Zippable = { [DATA_FILE]: [strToU8(JSON.stringify(data)), { level: 6 }] };
  if (includeMusic) {
    for (const t of data.tables.tracks) {
      if (t.deletedAt !== undefined) continue;
      const f = await db.trackFiles.get(t.fileId);
      if (!f) continue;
      files[musicPath(t)] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
    }
  }
  return zipSync(files);
}

/** Convenience: the zip as a Blob ready for download / FileSystem writes. */
export async function exportZipBlob(opts: ExportOptions = {}): Promise<Blob> {
  const bytes = await exportZip(opts);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ParsedPackage {
  data: BackupData;
  /** fileId → audio bytes. */
  music: Map<string, Uint8Array>;
}

async function toBytes(input: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(await input.arrayBuffer());
}

/** Unzip and validate a backup / setup package without touching the database. */
export async function readPackage(input: Blob | ArrayBuffer | Uint8Array): Promise<ParsedPackage> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await toBytes(input));
  } catch {
    throw new BackupFormatError('File không phải gói .zip hợp lệ.');
  }
  const raw = entries[DATA_FILE];
  if (!raw) throw new BackupFormatError('Gói thiếu data.json.');
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new BackupFormatError('data.json bị hỏng.');
  }
  const parsed = backupDataSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new BackupFormatError(`Dữ liệu không hợp lệ: ${first ? `${first.path.join('.')} – ${first.message}` : 'không rõ'}`);
  }
  const music = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith(MUSIC_DIR) || path.endsWith('/')) continue;
    const fileId = path.slice(MUSIC_DIR.length).replace(/\.[^.]*$/, '');
    music.set(fileId, bytes);
  }
  return { data: parsed.data, music };
}

export interface ImportSummary {
  format: BackupFormat;
  classes: number;
  students: number;
  tracks: number;
  /** Live tracks whose audio is neither in the package nor already on this device. */
  missingMusic: number;
}

export interface ImportOptions {
  /**
   * 'replace' (default for backups): wipe synced data first and adopt the backup's
   * ownerId as this device's owner (restore after clearing the browser).
   * 'merge' (default for setup packages): upsert rows, re-assigning ownerId to the local owner.
   */
  mode?: 'replace' | 'merge';
}

/** Import a backup or setup package in a single transaction. Validates everything first. */
export async function importPackage(input: Blob | ArrayBuffer | Uint8Array, opts: ImportOptions = {}): Promise<ImportSummary> {
  const { data, music } = await readPackage(input);
  const mode = opts.mode ?? (data.format === 'lnv-backup' ? 'replace' : 'merge');
  const adoptOwner = mode === 'replace' && data.ownerId !== undefined;
  const ownerId = adoptOwner ? data.ownerId! : await getLocalOwnerId();

  const files = new Map<string, Blob>();
  for (const t of data.tables.tracks) {
    const bytes = music.get(t.fileId);
    if (bytes) files.set(t.fileId, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: t.mimeType }));
  }

  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      for (const name of SYNC_TABLES) await db.table(name).clear();
      await db.errorLogs.clear();
    }
    if (adoptOwner) await setLocalOwnerId(ownerId);
    for (const name of SYNC_TABLES) {
      const rows = data.tables[name as BackupTableName] as BackupTables[typeof name];
      if (!rows.length) continue;
      const owned = mode === 'merge' || !adoptOwner ? rows.map((r) => ({ ...r, ownerId })) : rows.map((r) => ({ ...r, ownerId: r.ownerId ?? ownerId }));
      await db.table(name).bulkPut(owned);
    }
    if (data.tables.errorLogs.length) await db.errorLogs.bulkPut(data.tables.errorLogs);
    await db.trackFiles.bulkPut([...files].map(([id, blob]) => ({ id, blob })));
    // drop audio no live track points to
    const referenced = new Set((await db.tracks.toArray()).filter((t) => isLive(t)).map((t) => t.fileId));
    const orphans = (await db.trackFiles.toCollection().primaryKeys()).filter((id) => !referenced.has(id));
    await db.trackFiles.bulkDelete(orphans);
  });

  const liveTracks = data.tables.tracks.filter((t) => t.deletedAt === undefined);
  const present = new Set(await db.trackFiles.toCollection().primaryKeys());
  return {
    format: data.format,
    classes: data.tables.classes.filter((r) => r.deletedAt === undefined).length,
    students: data.tables.students.filter((r) => r.deletedAt === undefined).length,
    tracks: liveTracks.length,
    missingMusic: liveTracks.filter((t) => !present.has(t.fileId)).length,
  };
}

/** "Xoá toàn bộ dữ liệu trên máy này": clears every table (incl. owner id, prefs, music). */
export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
