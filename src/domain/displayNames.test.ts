import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { displayNames } from './displayNames';

describe('displayNames', () => {
  it('uses the given name when unique', () => {
    expect(displayNames(['Nguyễn Văn An', 'Trần Thị Bình'])).toEqual(['An', 'Bình']);
  });

  it('adds the middle name for duplicates (SPEC example)', () => {
    expect(displayNames(['Nguyễn Minh An', 'Lê Bảo An', 'Trần Thị Bình'])).toEqual(['Minh An', 'Bảo An', 'Bình']);
  });

  it('adds the family initial when two words still collide', () => {
    expect(displayNames(['Nguyễn Minh An', 'Lê Minh An', 'Trần Bảo An'])).toEqual(['N. Minh An', 'L. Minh An', 'Bảo An']);
  });

  it('falls back to the full name, then numbering', () => {
    expect(displayNames(['Nguyễn Minh An', 'Ngô Minh An'])).toEqual(['Nguyễn Minh An', 'Ngô Minh An']);
    expect(displayNames(['Lê An', 'Lê An'])).toEqual(['Lê An', 'Lê An (2)']);
  });

  it('normalizes NFD input and extra spaces', () => {
    expect(displayNames(['  Nguyễn   Văn  Đức '.normalize('NFD')])).toEqual(['Đức']);
  });

  const word = fc.constantFrom('Nguyễn', 'Lê', 'Trần', 'Ngô', 'Minh', 'Bảo', 'Thị', 'Văn', 'An', 'Bình', 'Châu', 'Đức', 'Anh', 'Ngọc');
  const fullName = fc.array(word, { minLength: 1, maxLength: 4 }).map((w) => w.join(' '));

  it('property: display names are unique within a class when full names are distinct', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fullName, { maxLength: 50 }), (names) => {
        const out = displayNames(names);
        expect(out).toHaveLength(names.length);
        expect(new Set(out).size).toBe(out.length);
      }),
    );
  });

  it('property: always unique, even with identical full names', () => {
    fc.assert(
      fc.property(fc.array(fullName, { maxLength: 30 }), (names) => {
        const out = displayNames(names);
        expect(new Set(out).size).toBe(out.length);
      }),
    );
  });

  it('property: a unique given name is shown alone', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fullName, { maxLength: 20 }), (names) => {
        const out = displayNames(names);
        names.forEach((n, i) => {
          const last = n.split(' ').at(-1)!;
          if (names.filter((m) => m.split(' ').at(-1) === last).length === 1) expect(out[i]).toBe(last);
        });
      }),
    );
  });
});
