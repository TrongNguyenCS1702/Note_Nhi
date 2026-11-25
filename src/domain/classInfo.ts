import type { Grade } from './schemas/tables';
import { cleanText, fold } from './text';

/**
 * Normalize a class name: strip a leading "Lớp" (any case / diacritics), remove
 * inner spaces, uppercase. "lớp 3a" → "3A", "LỚP 3 A" → "3A".
 */
export function normalizeClassName(raw: string): string {
  let s = cleanText(raw);
  if (/^lop\b/.test(fold(s))) s = s.slice(3).trim();
  s = s.replace(/^[:.\-\s]+/, '');
  return s.replace(/\s+/g, '').toUpperCase();
}

/** '3A' → 3; 'Lớp 5B' → 5; '10A' / 'A1' → null. */
export function gradeFromClassName(name: string): Grade | null {
  const m = /^([1-5])(?!\d)/.exec(normalizeClassName(name));
  return m ? (Number(m[1]) as Grade) : null;
}

/** School year containing `now` (local time). August or later starts a new year. */
export function schoolYearFor(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const start = d.getMonth() >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** '2026-2027' → '2027-2028'. */
export function nextSchoolYear(schoolYear: string): string {
  const start = Number(schoolYear.slice(0, 4)) + 1;
  return `${start}-${start + 1}`;
}

/** '3A' → '4A'; grade 5 (graduating) or unknown grade → null. */
export function promoteClassName(name: string): string | null {
  const n = normalizeClassName(name);
  const g = gradeFromClassName(n);
  if (g === null || g === 5) return null;
  return `${g + 1}${n.slice(1)}`;
}
