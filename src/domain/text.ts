/** NFC-normalize, trim and collapse all whitespace (incl. NBSP, tabs) into single spaces. */
export function cleanText(s: string): string {
  return s.normalize('NFC').replace(/[\s\u00a0\u200b\ufeff]+/g, ' ').trim();
}

/**
 * Fold for case/diacritic-insensitive comparison: lowercase, strip Vietnamese
 * diacritics (incl. đ → d), collapse whitespace.
 */
export function fold(s: string): string {
  return cleanText(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

/** "NGUYỄN VĂN AN" → "Nguyễn Văn An"; mixed-case input is returned unchanged. */
export function titleCaseIfAllCaps(s: string): string {
  const hasLower = s !== s.toUpperCase();
  if (hasLower) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
    .normalize('NFC');
}
