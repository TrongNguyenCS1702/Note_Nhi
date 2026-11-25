import { describe, expect, it } from 'vitest';
import {
  autoBackupFileName,
  backupReminder,
  filesToPrune,
  isBackupDue,
  REMINDER_EVERY_MS,
  runAutoBackupIfDue,
  type AutoBackupDeps,
  type BackupDir,
} from './autoBackup';

const day = (d: number, h = 10) => new Date(2026, 10, d, h, 0).getTime();

describe('isBackupDue', () => {
  it('is due when never backed up or on a new local day, once per day', () => {
    expect(isBackupDue(undefined, day(25))).toBe(true);
    expect(isBackupDue(day(25, 8), day(25, 23))).toBe(false);
    expect(isBackupDue(day(24, 23), day(25, 0))).toBe(true);
  });
});

describe('filesToPrune', () => {
  it('keeps the newest 7 auto backups and ignores other files', () => {
    const names = Array.from({ length: 10 }, (_, i) => autoBackupFileName(day(i + 1)));
    const pruned = filesToPrune([...names, 'notes.txt', 'lop-nhac-vui-2026-11-01.zip']);
    expect(pruned).toEqual([names[2], names[1], names[0]]);
    expect(filesToPrune(names.slice(0, 7))).toEqual([]);
  });
});

describe('backupReminder', () => {
  const now = day(25);
  it('asks for permission when a folder exists but access is not granted', () => {
    expect(backupReminder({ hasFolder: true, permission: 'prompt', reminderAt: undefined, now })).toBe('needs-permission');
    expect(backupReminder({ hasFolder: true, permission: 'granted', reminderAt: undefined, now })).toBeNull();
  });
  it('nudges to choose a folder every 14 days', () => {
    expect(backupReminder({ hasFolder: false, permission: null, reminderAt: undefined, now })).toBe('no-folder-reminder');
    expect(backupReminder({ hasFolder: false, permission: null, reminderAt: now - REMINDER_EVERY_MS + 1, now })).toBeNull();
    expect(backupReminder({ hasFolder: false, permission: null, reminderAt: now - REMINDER_EVERY_MS, now })).toBe('no-folder-reminder');
  });
});

class MemDir implements BackupDir {
  files = new Map<string, string>();
  constructor(public permission: PermissionState = 'granted') {}
  queryPermission = async () => this.permission;
  getFileHandle = async (name: string) => ({
    createWritable: async () => ({
      write: async (b: Blob) => void this.files.set(name, await b.text()),
      close: async () => {},
    }),
  });
  removeEntry = async (name: string) => void this.files.delete(name);
  async *keys() {
    yield* this.files.keys();
  }
}

function deps(dir: BackupDir | undefined, last?: number) {
  const state = { last, writes: 0 };
  const d: AutoBackupDeps = {
    getDir: async () => dir,
    getLastBackupAt: async () => state.last,
    setLastBackupAt: async (n) => void (state.last = n),
    makeBlob: async () => {
      state.writes++;
      return new Blob(['zip']);
    },
  };
  return { d, state };
}

describe('runAutoBackupIfDue', () => {
  it('does nothing without a folder or permission (never prompts)', async () => {
    expect(await runAutoBackupIfDue(day(25), deps(undefined).d)).toBe('no-folder');
    const dir = new MemDir('prompt');
    expect(await runAutoBackupIfDue(day(25), deps(dir).d)).toBe('no-permission');
    expect(dir.files.size).toBe(0);
  });

  it('writes once per day and keeps the newest 7', async () => {
    const dir = new MemDir();
    const { d, state } = deps(dir);
    for (let i = 1; i <= 9; i++) {
      expect(await runAutoBackupIfDue(day(i), d)).toBe('written');
      expect(await runAutoBackupIfDue(day(i, 18), d)).toBe('not-due');
    }
    expect(state.writes).toBe(9);
    expect(state.last).toBe(day(9));
    expect([...dir.files.keys()].sort()).toEqual(Array.from({ length: 7 }, (_, i) => autoBackupFileName(day(i + 3))));
  });
});
