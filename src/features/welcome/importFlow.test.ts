// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { addTrack, exportZip, getOnboardedAt, importRoster, isEmpty, listTracks, wipeAll } from '@/db';
import { parseRosterText } from '@/domain/roster';
import { completeOnboarding, importSetupFile, packageSummaryText } from './importFlow';

const NOW = new Date(2026, 10, 25, 8, 0).getTime();

async function makePackage(): Promise<Uint8Array> {
  await importRoster(parseRosterText('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLớp 4B\nLê Văn Cường'), { now: NOW });
  await addTrack({ blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }), filename: '01_Trong_com.mp3', mood: 'lively' }, NOW);
  const zip = await exportZip({ format: 'note-nhi-setup' });
  await wipeAll(); // the teacher's device starts empty
  return zip;
}

beforeEach(async () => {
  await wipeAll();
});

describe('welcome: setup package import', () => {
  it('imports a package made by exportZip and summarizes it', async () => {
    const zip = await makePackage();
    expect(await isEmpty()).toBe(true);
    const res = await importSetupFile(Object.assign(new Blob([zip as Uint8Array<ArrayBuffer>]), { name: 'note-nhi-2026-11-25.zip' }));
    expect(res).toMatchObject({ ok: true, text: '2 lớp · 3 học sinh · 1 bài nhạc' });
    expect(await isEmpty()).toBe(false);
    expect((await listTracks()).map((t) => t.title)).toEqual(['Trong com']);

    expect(await getOnboardedAt()).toBeUndefined();
    await completeOnboarding(NOW);
    expect(await getOnboardedAt()).toBe(NOW);
  });

  it('rejects non-zip files and broken packages with a friendly message', async () => {
    const wrong = await importSetupFile(Object.assign(new Blob(['x']), { name: 'danh-sach.xlsx' }));
    expect(wrong).toMatchObject({ ok: false });
    const broken = await importSetupFile(Object.assign(new Blob(['not a zip']), { name: 'goi.zip' }));
    expect(broken).toEqual({ ok: false, error: 'File không phải gói .zip hợp lệ.' });
    expect(await isEmpty()).toBe(true);
  });

  it('formats the summary without music', () => {
    expect(packageSummaryText({ classes: 21, students: 838, tracks: 6 })).toBe('21 lớp · 838 học sinh · 6 bài nhạc');
    expect(packageSummaryText({ classes: 1, students: 40, tracks: 0 })).toBe('1 lớp · 40 học sinh');
  });
});
