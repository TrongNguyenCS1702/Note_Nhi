import { cleanText } from './text';

/**
 * Track title from a file name (SPEC 3.8): drop the extension and leading
 * numbering, turn `_` / `-` into spaces, trim.
 * "01 - Beo_dat_may_troi.mp3" → "Beo dat may troi".
 */
export function trackTitleFromFilename(filename: string): string {
  const base = cleanText(filename.replace(/^.*[\\/]/, ''));
  const noExt = base.replace(/\.[a-z0-9]{1,5}$/i, '');
  const noNum = noExt.replace(/^\d+[\s._\-–)]*(?=\D)/, '');
  const title = cleanText(noNum.replace(/[_-]+/g, ' '));
  return title || cleanText(noExt.replace(/[_-]+/g, ' ')) || base;
}
