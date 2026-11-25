import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classHeaderOf, mergeRosters, parseRosterText, parseStudentLine, rosterFromRows, rosterIssues } from './roster';

const names = (r: ReturnType<typeof parseRosterText>, i = 0) => r.classes[i]!.students.map((s) => s.fullName);

describe('parseStudentLine', () => {
  it.each([
    ['Nguyễn Văn An', null, 'Nguyễn Văn An'],
    ['12. Nguyễn Văn An', 12, 'Nguyễn Văn An'],
    ['12) Nguyễn Văn An', 12, 'Nguyễn Văn An'],
    ['12\tNguyễn Văn An', 12, 'Nguyễn Văn An'],
    ['3 - Lê Thị  Bình ', 3, 'Lê Thị Bình'],
    ['1\tNguyễn Văn\tAn\t12/03/2018\tNam', 1, 'Nguyễn Văn An'],
    ['NGUYỄN VĂN ĐỨC', null, 'Nguyễn Văn Đức'],
    ['Tống Văn Bảo', null, 'Tống Văn Bảo'],
  ])('%s', (line, order, fullName) => {
    expect(parseStudentLine(line)).toEqual({ order, fullName });
  });

  it.each(['', '   ', 'STT', 'Họ và tên', 'Tổng số: 40', 'Tổng cộng', '12', '---'])('skips %j', (line) => {
    expect(parseStudentLine(line)).toBeNull();
  });
});

describe('classHeaderOf', () => {
  it.each([
    ['Lớp 3A', '3A'],
    ['LỚP 3A', '3A'],
    ['lớp 3a:', '3A'],
    ['3A:', '3A'],
    ['Lop 5B1', '5B1'],
    ['DANH SÁCH HỌC SINH LỚP 4C', '4C'],
  ])('%s → %s', (line, name) => expect(classHeaderOf(line)).toBe(name));

  it.each(['3A', 'Nguyễn Văn An', '12. Lớp trưởng An'])('not a header: %s', (line) => expect(classHeaderOf(line)).toBeNull());
});

describe('parseRosterText', () => {
  it('parses a single class with ordinals and NFD input', () => {
    const text = ['1. Nguyễn Văn An', '2. Trần Thị Bình'.normalize('NFD'), '', '3) Lê Minh Châu'].join('\r\n');
    const r = parseRosterText(text, '3a');
    expect(r.classes).toHaveLength(1);
    expect(r.classes[0]!.name).toBe('3A');
    expect(r.classes[0]!.grade).toBe(3);
    expect(names(r)).toEqual(['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Châu']);
    expect(names(r)[1]).toBe('Trần Thị Bình'.normalize('NFC'));
  });

  it('sorts by ordinal and keeps order values', () => {
    const r = parseRosterText('3. Cường Lê\n1. An Nguyễn\n2. Bình Trần');
    expect(r.classes[0]!.students.map((s) => s.order)).toEqual([1, 2, 3]);
    expect(names(r)[0]).toBe('An Nguyễn');
  });

  it('splits a multi-class paste on headers', () => {
    const text = 'Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\n3B:\n1. Lê Văn Cường\nLỚP 4A\nPhạm Thị Dung\nLớp 3A\nVõ Văn Em';
    const r = parseRosterText(text);
    expect(r.classes.map((c) => c.name)).toEqual(['3A', '3B', '4A']);
    expect(names(r, 0)).toEqual(['Nguyễn Văn An', 'Trần Thị Bình', 'Võ Văn Em']);
    expect(r.classes[2]!.grade).toBe(4);
  });

  it('students before any header go to an unnamed class (with a warning)', () => {
    const r = parseRosterText('Nguyễn Văn An');
    expect(r.classes[0]!.name).toBe('');
    expect(r.warnings.some((w) => w.includes('tên lớp'))).toBe(true);
  });

  it('flags one-word names, duplicates and odd class sizes', () => {
    const r = parseRosterText('Lớp 3A\nAn\nNguyễn Văn Bình\nnguyen van binh');
    const kinds = rosterIssues(r.classes[0]!).map((i) => i.kind).sort();
    expect(kinds).toEqual(['duplicate', 'oneWord', 'smallClass']);
    expect(r.warnings.length).toBe(3);
    const big = parseRosterText('Lớp 3A\n' + Array.from({ length: 51 }, (_, i) => `${i + 1}. Học Sinh ${'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY'[i]}`).join('\n'));
    expect(rosterIssues(big.classes[0]!).map((i) => i.kind)).toContain('largeClass');
  });

  it('property: a simple list round-trips (with or without ordinals)', () => {
    const word = fc.constantFrom('Nguyễn', 'Lê', 'Trần', 'Văn', 'Thị', 'Minh', 'An', 'Bình', 'Châu', 'Đức', 'Ngọc', 'Hương');
    const name = fc.array(word, { minLength: 2, maxLength: 4 }).map((w) => w.join(' '));
    fc.assert(
      fc.property(fc.array(name, { minLength: 1, maxLength: 45 }), fc.constantFrom('', '. ', ') ', '\t'), fc.boolean(), (list, sep, nfd) => {
        const text = list.map((n, i) => (sep ? `${i + 1}${sep}` : '') + (nfd ? n.normalize('NFD') : n)).join('\n');
        const r = parseRosterText(text, '2B');
        expect(r.classes).toHaveLength(1);
        expect(names(r)).toEqual(list.map((n) => n.normalize('NFC')));
        expect(r.classes[0]!.students.map((s) => s.order)).toEqual(list.map((_, i) => i + 1));
      }),
    );
  });
});

describe('rosterFromRows', () => {
  it('reads a sheet with a "Họ và tên" header; sheet name is the class', () => {
    const rows = [
      ['TRƯỜNG TIỂU HỌC ABC'],
      [],
      ['STT', 'Họ và tên', 'Ngày sinh', 'Giới tính'],
      [1, 'Nguyễn Văn An', new Date(2018, 1, 1), 'Nam'],
      [2, '  trần   thị bình ', '01/02/2018', 'Nữ'],
      [null, null, null],
      ['', 'Tổng cộng', '', ''],
    ];
    const r = rosterFromRows('Lớp 3A', rows);
    expect(r.classes).toHaveLength(1);
    expect(r.classes[0]).toMatchObject({ name: '3A', grade: 3 });
    expect(names(r)).toEqual(['Nguyễn Văn An', 'trần thị bình']);
  });

  it('joins "Họ đệm" + "Tên" columns (case/diacritic-insensitive headers)', () => {
    const rows = [
      ['stt', 'HỌ ĐỆM', 'TÊN', 'Ngày sinh'],
      [2, 'Lê Thị', 'Bình', ''],
      [1, 'Nguyễn Văn', 'An', ''],
    ];
    const r = rosterFromRows('4B', rows);
    expect(names(r)).toEqual(['Nguyễn Văn An', 'Lê Thị Bình']);
  });

  it('groups a single sheet by the "Lớp" column', () => {
    const rows = [
      ['STT', 'Họ tên', 'Lớp'],
      [1, 'Nguyễn Văn An', '3A'],
      [2, 'Trần Thị Bình', '3B'],
      [3, 'Lê Văn Cường', 'Lớp 3A'],
      [4, 'Phạm Dung', ''],
    ];
    const r = rosterFromRows('Sheet1', rows);
    expect(r.classes.map((c) => c.name)).toEqual(['3A', '3B']);
    expect(names(r, 0)).toEqual(['Nguyễn Văn An', 'Lê Văn Cường']);
    expect(r.warnings.some((w) => w.includes('Phạm Dung'))).toBe(true);
  });

  it('falls back to guessing the name column without a header', () => {
    const r = rosterFromRows('5A', [
      [1, 'Nguyễn Văn An', 'Nam'],
      [2, 'Trần Thị Bình', 'Nữ'],
    ]);
    expect(names(r)).toEqual(['Nguyễn Văn An', 'Trần Thị Bình']);
    expect(r.warnings.some((w) => w.includes('tiêu đề'))).toBe(true);
  });

  it('mergeRosters concatenates same-name classes', () => {
    const a = rosterFromRows('3A', [['Họ và tên'], ['Nguyễn Văn An']]);
    const b = rosterFromRows('3A', [['Họ và tên'], ['Trần Thị Bình']]);
    const c = rosterFromRows('3B', [['Họ và tên'], ['Lê Văn Cường']]);
    const m = mergeRosters([a, b, c]);
    expect(m.classes.map((x) => x.name)).toEqual(['3A', '3B']);
    expect(names(m, 0)).toEqual(['Nguyễn Văn An', 'Trần Thị Bình']);
    expect(m.warnings.filter((w) => w.includes('3A')).length).toBe(1); // only the merged small-class warning
  });
});
