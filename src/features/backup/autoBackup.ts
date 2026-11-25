import { localDateKey } from '@/domain/time';
import { exportZipBlob, getBackupDirHandle, getBackupReminderAt, getLastBackupAt, logError, setBackupDirHandle, setLastBackupAt } from '@/db';

// Sao lưu tự động (SPEC 3.7): the teacher picks one folder once (ideally inside Google Drive /
// OneDrive). On returning home the app writes a dated zip at most once per day and keeps 7.

export const BACKUP_KEEP = 7;
export const REMINDER_EVERY_MS = 14 * 24 * 60 * 60 * 1000;
const AUTO_NAME = /^lop-nhac-vui-backup-(\d{4}-\d{2}-\d{2})\.zip$/;

// ---------------------------------------------------------------- pure logic

/** `lop-nhac-vui-backup-YYYY-MM-DD.zip` (local date). */
export const autoBackupFileName = (now: number): string => `lop-nhac-vui-backup-${localDateKey(now)}.zip`;

/** At most one automatic backup per local calendar day. */
export function isBackupDue(lastBackupAt: number | undefined, now: number): boolean {
  return lastBackupAt === undefined || localDateKey(lastBackupAt) !== localDateKey(now);
}

/** Auto-backup files to delete so only the newest `keep` remain (other files are never touched). */
export function filesToPrune(names: readonly string[], keep: number = BACKUP_KEEP): string[] {
  const ours = names.filter((n) => AUTO_NAME.test(n)).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return ours.slice(keep);
}

export type BackupReminder = 'needs-permission' | 'no-folder-reminder' | null;

/** What the home screen should show (never blocks teaching). */
export function backupReminder(input: { hasFolder: boolean; permission: PermissionState | null; reminderAt: number | undefined; now: number }): BackupReminder {
  if (input.hasFolder) return input.permission === 'granted' ? null : 'needs-permission';
  if (input.reminderAt === undefined || input.now - input.reminderAt >= REMINDER_EVERY_MS) return 'no-folder-reminder';
  return null;
}

// ---------------------------------------------------------------- File System Access glue

interface Writable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

/** The parts of FileSystemDirectoryHandle we use (permission methods aren't in lib.dom yet). */
export interface BackupDir {
  name?: string;
  queryPermission?(desc: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(desc: { mode: 'readwrite' }): Promise<PermissionState>;
  getFileHandle(name: string, opts: { create: boolean }): Promise<{ createWritable(): Promise<Writable> }>;
  removeEntry(name: string): Promise<void>;
  keys?(): AsyncIterable<string>;
}

type DirectoryPicker = (opts?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandle>;

const picker = (): DirectoryPicker | undefined =>
  typeof window !== 'undefined' ? (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker : undefined;

export const isFolderBackupSupported = (): boolean => picker() !== undefined;

export async function permissionOf(dir: BackupDir): Promise<PermissionState> {
  if (!dir.queryPermission) return 'granted';
  try {
    return await dir.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'prompt';
  }
}

/** Ask for write permission again. Must be called from a click (user gesture). */
export async function requestBackupPermission(): Promise<boolean> {
  const dir = (await getBackupDirHandle()) as BackupDir | undefined;
  if (!dir) return false;
  if (!dir.requestPermission) return true;
  try {
    return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Let the teacher pick the backup folder (call from a click). Returns the folder name,
 * or null when cancelled / unsupported.
 */
export async function chooseBackupFolder(): Promise<string | null> {
  const pick = picker();
  if (!pick) return null;
  try {
    const handle = await pick({ id: 'lnv-backup', mode: 'readwrite', startIn: 'documents' });
    await setBackupDirHandle(handle);
    return handle.name;
  } catch {
    return null; // AbortError when the dialog is closed
  }
}

async function listNames(dir: BackupDir): Promise<string[]> {
  if (!dir.keys) return [];
  const names: string[] = [];
  for await (const n of dir.keys()) names.push(n);
  return names;
}

/** Write today's backup into `dir` and prune old ones. */
export async function writeBackupTo(dir: BackupDir, blob: Blob, now: number): Promise<string> {
  const name = autoBackupFileName(now);
  const file = await dir.getFileHandle(name, { create: true });
  const w = await file.createWritable();
  await w.write(blob);
  await w.close();
  for (const old of filesToPrune(await listNames(dir))) {
    await dir.removeEntry(old).catch(() => undefined);
  }
  return name;
}

export type AutoBackupResult = 'no-folder' | 'no-permission' | 'not-due' | 'written' | 'error';

export interface AutoBackupDeps {
  getDir: () => Promise<BackupDir | undefined>;
  getLastBackupAt: () => Promise<number | undefined>;
  setLastBackupAt: (now: number) => Promise<void>;
  makeBlob: () => Promise<Blob>;
}

const defaultDeps: AutoBackupDeps = {
  getDir: async () => (await getBackupDirHandle()) as BackupDir | undefined,
  getLastBackupAt,
  setLastBackupAt: (now) => setLastBackupAt(now),
  makeBlob: () => exportZipBlob({ format: 'lnv-backup', includeMusic: false }),
};

/**
 * Write `lop-nhac-vui-backup-YYYY-MM-DD.zip` into the chosen folder if one exists, permission is
 * already granted (never prompts) and no backup was made today. Keeps the newest 7.
 */
export async function runAutoBackupIfDue(now: number = Date.now(), deps: AutoBackupDeps = defaultDeps): Promise<AutoBackupResult> {
  try {
    const dir = await deps.getDir();
    if (!dir) return 'no-folder';
    if ((await permissionOf(dir)) !== 'granted') return 'no-permission';
    if (!isBackupDue(await deps.getLastBackupAt(), now)) return 'not-due';
    await writeBackupTo(dir, await deps.makeBlob(), now);
    await deps.setLastBackupAt(now);
    return 'written';
  } catch (e) {
    void logError({ screen: 'autoBackup', message: String(e) });
    return 'error';
  }
}

/** "Sao lưu ngay" (from a click): asks permission if needed, ignores the once-a-day rule. */
export async function backupNow(now: number = Date.now()): Promise<'written' | 'no-folder' | 'no-permission'> {
  const dir = (await getBackupDirHandle()) as BackupDir | undefined;
  if (!dir) return 'no-folder';
  if ((await permissionOf(dir)) !== 'granted' && !(await requestBackupPermission())) return 'no-permission';
  await writeBackupTo(dir, await exportZipBlob({ format: 'lnv-backup', includeMusic: false }), now);
  await setLastBackupAt(now);
  return 'written';
}

/** Current reminder state from the database. */
export async function loadBackupReminder(now: number): Promise<BackupReminder> {
  const dir = (await getBackupDirHandle()) as BackupDir | undefined;
  return backupReminder({
    hasFolder: dir !== undefined,
    permission: dir ? await permissionOf(dir) : null,
    reminderAt: await getBackupReminderAt(),
    now,
  });
}
