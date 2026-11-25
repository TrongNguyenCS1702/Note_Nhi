import type { CSSProperties } from 'react';

/** Join truthy class names. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Typed helper for inline CSS custom properties, e.g. `style={cssVars({ '--c': 'var(--sun)' })}`. */
export function cssVars(
  vars: Record<`--${string}`, string | number | undefined>,
  extra?: CSSProperties,
): CSSProperties {
  return { ...extra, ...(vars as CSSProperties) };
}

/** Sticker palette cycle used for name stickers (mockup `STICKER`). */
export const STICKER_COLORS = ['--pink', '--sun', '--mint', '--sky', '--orange', '--lilac'] as const;
export type StickerColor = (typeof STICKER_COLORS)[number];

/** `var(--pink)`, `var(--sun)`… by index, like mockup `stickerStyle(i)`. */
export function stickerColor(i: number): string {
  const n = STICKER_COLORS.length;
  return `var(${STICKER_COLORS[((i % n) + n) % n] ?? '--paper'})`;
}
