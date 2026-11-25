import { STICKER_COLORS } from './cx';

type Fire = () => void;
let host: Fire | null = null;

/** Called by `<Confetti />` on mount. Returns an unregister function. */
export function registerConfettiHost(fire: Fire): () => void {
  host = fire;
  return () => {
    if (host === fire) host = null;
  };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Burst of sticker-colored confetti from the middle of the screen. No-op with reduced motion or no host. */
export function fireConfetti(): void {
  if (prefersReducedMotion()) return;
  host?.();
}

export const CONFETTI_COLORS = STICKER_COLORS;
