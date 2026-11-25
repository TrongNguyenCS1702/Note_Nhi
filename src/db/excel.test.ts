// @vitest-environment node
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { readSpreadsheet, rosterFromSpreadsheet } from './excel';

function workbook(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

describe('excel import', () => {
  it('reads sheets into rows', async () => {
    const sheets = await readSpreadsheet(workbook({ '3A': [['STT', 'Họ và tên'], [1, 'Nguyễn Văn An']] }));
    expect(sheets).toEqual([{ name: '3A', rows: [['STT', 'Họ và tên'], [1, 'Nguyễn Văn An']] }]);
  });

  it('multi-sheet file: one class per sheet, ignoring a summary sheet', async () => {
    const bytes = workbook({
      'Lớp 3A': [['DANH SÁCH HỌC SINH'], ['STT', 'Họ đệm', 'Tên', 'Ngày sinh'], [1, 'Nguyễn Văn', 'An', new Date(2018, 0, 2)], [2, 'Trần Thị', 'Bình', null]],
      '3B': [['STT', 'Họ và tên'], [1, 'Lê Văn Cường']],
      'Tổng hợp': [['Khối 3', 'Tổng số học sinh'], ['Ghi chú', 'Lê Thị Đào']],
    });
    const r = await rosterFromSpreadsheet(bytes);
    expect(r.classes.map((c) => [c.name, c.grade, c.students.map((s) => s.fullName)])).toEqual([
      ['3A', 3, ['Nguyễn Văn An', 'Trần Thị Bình']],
      ['3B', 3, ['Lê Văn Cường']],
    ]);
  });

  it('single sheet with a "Lớp" column groups into classes', async () => {
    const bytes = workbook({
      DanhSach: [
        ['STT', 'Mã HS', 'Họ và tên', 'Giới tính', 'Lớp'],
        [1, 'HS01', 'Nguyễn Văn An', 'Nam', '1A'],
        [2, 'HS02', 'Trần Thị Bình', 'Nữ', '2B'],
        [3, 'HS03', 'Lê Văn Cường', 'Nam', '1A'],
      ],
    });
    const r = await rosterFromSpreadsheet(bytes);
    expect(r.classes.map((c) => [c.name, c.students.length])).toEqual([
      ['1A', 2],
      ['2B', 1],
    ]);
  });

  it('reads UTF-8 CSV by file name', async () => {
    const csv = new TextEncoder().encode('STT,Họ và tên,Lớp\n1,Nguyễn Văn An,4A\n2,Đỗ Thị Hương,4A\n');
    const r = await rosterFromSpreadsheet(csv, { fileName: 'ds.csv' });
    expect(r.classes[0]!.students.map((s) => s.fullName)).toEqual(['Nguyễn Văn An', 'Đỗ Thị Hương']);
  });
});
