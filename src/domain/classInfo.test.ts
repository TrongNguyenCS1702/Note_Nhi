import { describe, expect, it } from 'vitest';
import { gradeFromClassName, nextSchoolYear, normalizeClassName, promoteClassName, schoolYearFor } from './classInfo';
import { cleanText, fold, titleCaseIfAllCaps } from './text';

const at = (y: number, m: number, d = 1) => new Date(y, m - 1, d, 10).getTime();

describe('classInfo', () => {
  it('normalizes class names', () => {
    expect(normalizeClassName('lớp 3a')).toBe('3A');
    expect(normalizeClassName('LỚP 3 A')).toBe('3A');
    expect(normalizeClassName(' 5b1 ')).toBe('5B1');
  });

  it('derives grade 1–5 or null', () => {
    expect(gradeFromClassName('3A')).toBe(3);
    expect(gradeFromClassName('Lớp 5B')).toBe(5);
    expect(gradeFromClassName('1A2')).toBe(1);
    expect(gradeFromClassName('6A')).toBeNull();
    expect(gradeFromClassName('10A')).toBeNull();
    expect(gradeFromClassName('A1')).toBeNull();
    expect(gradeFromClassName('')).toBeNull();
  });

  it('school year switches in August', () => {
    expect(schoolYearFor(at(2026, 11, 25))).toBe('2026-2027');
    expect(schoolYearFor(at(2027, 7, 31))).toBe('2026-2027');
    expect(schoolYearFor(at(2027, 8, 1))).toBe('2027-2028');
    expect(schoolYearFor(at(2027, 1, 1))).toBe('2026-2027');
    expect(nextSchoolYear('2026-2027')).toBe('2027-2028');
  });

  it('promotes class names; grade 5 graduates', () => {
    expect(promoteClassName('3A')).toBe('4A');
    expect(promoteClassName('1A2')).toBe('2A2');
    expect(promoteClassName('5C')).toBeNull();
    expect(promoteClassName('XYZ')).toBeNull();
  });
});

describe('text helpers', () => {
  it('cleanText NFC-normalizes and collapses whitespace', () => {
    const nfd = 'Nguyễn  Văn An'.normalize('NFD');
    expect(cleanText(`  ${nfd}\t`)).toBe('Nguyễn Văn An'.normalize('NFC'));
  });
  it('fold strips diacritics and case', () => {
    expect(fold('Họ VÀ Tên')).toBe('ho va ten');
    expect(fold('Đặng')).toBe('dang');
  });
  it('title-cases only all-caps strings', () => {
    expect(titleCaseIfAllCaps('NGUYỄN VĂN ĐỨC')).toBe('Nguyễn Văn Đức');
    expect(titleCaseIfAllCaps('Nguyễn văn An')).toBe('Nguyễn văn An');
  });
});
