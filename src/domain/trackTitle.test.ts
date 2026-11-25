import { describe, expect, it } from 'vitest';
import { trackTitleFromFilename } from './trackTitle';

describe('trackTitleFromFilename', () => {
  it.each([
    ['01 - Bèo dạt mây trôi.mp3', 'Bèo dạt mây trôi'],
    ['03_Ly_cay_bong.m4a', 'Ly cay bong'],
    ['Trống-cơm (piano).MP3', 'Trống cơm (piano)'],
    ['12. Lý ngựa ô.mp3', 'Lý ngựa ô'],
    ['  inh   la oi .mp3', 'inh la oi'],
    ['C:\\Music\\02) Cò lả.mp3', 'Cò lả'],
    ['2024.mp3', '2024'],
    ['Ru con Nam Bộ', 'Ru con Nam Bộ'],
  ])('%s → %s', (file, title) => expect(trackTitleFromFilename(file)).toBe(title));
});
