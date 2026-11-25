import { BackupFormatError, getBackupDirHandle, importPackage, setOnboardedAt, type ImportSummary } from '@/db';

/** "21 lớp · 838 học sinh · 6 bài nhạc". */
export function packageSummaryText(s: Pick<ImportSummary, 'classes' | 'students' | 'tracks'>): string {
  const parts = [`${s.classes} lớp`, `${s.students} học sinh`];
  if (s.tracks > 0) parts.push(`${s.tracks} bài nhạc`);
  return parts.join(' · ');
}

export type PackageImportResult = { ok: true; summary: ImportSummary; text: string } | { ok: false; error: string };

const isZipName = (name: string) => /\.zip$/i.test(name);

/** Import the setup package (or a backup) the supporter sent. Never throws. */
export async function importSetupFile(file: Blob & { name?: string }): Promise<PackageImportResult> {
  if (file.name && !isZipName(file.name)) {
    return { ok: false, error: `"${file.name}" không phải gói cài đặt. Hãy chọn file note-nhi-….zip.` };
  }
  try {
    const summary = await importPackage(file);
    if (summary.classes === 0) return { ok: false, error: 'Gói này chưa có lớp nào. Nhờ người hỗ trợ kiểm tra lại.' };
    return { ok: true, summary, text: packageSummaryText(summary) };
  } catch (e) {
    return { ok: false, error: e instanceof BackupFormatError ? e.message : 'Không đọc được gói này. Nhờ người hỗ trợ gửi lại.' };
  }
}

/** "Xong, vào app": remember that onboarding is done. */
export async function completeOnboarding(now = Date.now()): Promise<void> {
  await setOnboardedAt(now);
}

export const hasBackupFolder = async (): Promise<boolean> => (await getBackupDirHandle()) !== undefined;
