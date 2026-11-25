// Shared helpers for the four reveal animations (port of the mockup chairs JS).
// Animations only PRESENT a result the machine already picked; they talk back via ctx.fakeout()/landing.
import type { AudioPort } from '@/audio/types';

/** One spin's lifetime. `dead` = the spin was skipped/closed; every await must check it. */
export interface Token {
  dead: boolean;
  spinId: number;
  /** Chase: snake position carried over to the duo's 2nd round. */
  pos: number | null;
}

export interface RevealEls {
  wrap: HTMLElement;
  rider: HTMLElement;
  spot: HTMLElement;
  ball: HTMLElement;
  claw: HTMLElement;
  banner: HTMLElement;
}

export interface RevealCtx {
  tok: Token;
  els: RevealEls;
  audio: AudioPort;
  rng: () => number;
  /** All grid cells in DOM order. */
  cells(): HTMLElement[];
  cellOf(studentId: string): HTMLElement | null;
  /** True while the machine is in the music phase of this round. */
  musicOn(): boolean;
  /** Machine decided this round fakes out (the animation may skip it if geometry doesn't allow). */
  fake: boolean;
  /** Enter the fake-out (machine plays the drum roll, bubble says "Dừng ở… ?"). */
  fakeout(): void;
  /** Mascot speech bubble line for the current phase. */
  say(text: string): void;
}

export type RevealRun = (ctx: RevealCtx, studentId: string, idx: number) => Promise<void>;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const easeIO = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const linear = (t: number) => t;

export function pickOne<T>(rng: () => number, a: readonly T[]): T | undefined {
  return a[Math.min(a.length - 1, Math.floor(rng() * a.length))];
}

export function shuffle<T>(rng: () => number, a: readonly T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = b[i]!;
    b[i] = b[j]!;
    b[j] = t;
  }
  return b;
}

export interface Pt {
  x: number;
  y: number;
}

/** Cell center in grid-wrap coordinates. */
export const ctr = (c: HTMLElement): Pt => ({
  x: c.offsetLeft + c.offsetWidth / 2,
  y: c.offsetTop + c.offsetHeight / 2,
});
export const dist = (a: HTMLElement, b: HTMLElement) => {
  const p = ctr(a);
  const q = ctr(b);
  return Math.hypot(p.x - q.x, p.y - q.y);
};

/** rAF tween; resolves early (without calling fn) once the spin is dead. */
export function tween(
  tok: Token,
  ms: number,
  fn: (e: number, t: number) => void,
  ease: (t: number) => number = easeIO,
): Promise<void> {
  return new Promise((res) => {
    const t0 = performance.now();
    const f = (now: number) => {
      if (tok.dead) return res();
      const t = Math.min(1, Math.max(0, (now - t0) / ms));
      fn(ease(t), t);
      if (t < 1) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });
}

export const freeCells = (ctx: RevealCtx) => ctx.cells().filter((c) => !c.classList.contains('picked'));
export const nearestTo = (cell: HTMLElement, pool: readonly HTMLElement[]) =>
  pool.filter((c) => c !== cell).sort((a, b) => dist(a, cell) - dist(b, cell))[0];

/** Fake-out pause: "Dừng ở… ?" + drum roll (~1.45 s). */
export async function fakeOut(ctx: RevealCtx): Promise<void> {
  ctx.fakeout();
  await sleep(1450);
}

/** Restart a one-shot CSS animation class. */
export function retrigger(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Winner cell flashes 3× then becomes `picked`. */
export async function landOn(ctx: RevealCtx, cell: HTMLElement): Promise<void> {
  cell.classList.add('flash');
  ctx.audio.sfx('tick');
  await sleep(700);
  if (ctx.tok.dead) return;
  cell.classList.remove('flash', 'grabbed');
  cell.classList.add('picked');
}

export const CELL_FX = ['hot', 't1', 't2', 't3', 'flash', 'bump', 'grabbed', 'wobble'] as const;
