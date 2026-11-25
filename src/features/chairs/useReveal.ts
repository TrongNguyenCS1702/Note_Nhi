// Drives the reveal animations from machine snapshots. The machine owns the phase; this hook only
// starts/aborts DOM animations when phases change and reports ANIM_FAKEOUT / ANIM_LANDED back.
import { useEffect, useRef, type RefObject } from 'react';
import type { ActorRefFrom } from 'xstate';
import type { AudioPort } from '@/audio/types';
import { chairsMachine, phaseOf, SPIN_PHASES, type ChairsSnapshot } from '@/machines/chairs';
import type { NameGridHandle } from '@/ui';
import { announce, CELL_FX, METHOD_INFO, moveRider, type RevealCtx, type RevealEls, type Token } from './reveal';

export type ChairsActor = ActorRefFrom<typeof chairsMachine>;

export interface RevealOptions {
  /** Effect layers inside `.grid-wrap`. */
  els: { readonly [K in keyof RevealEls]: RefObject<HTMLElement | null> };
  grid: RefObject<NameGridHandle | null>;
  audio: AudioPort;
  rng: () => number;
  /** Bubble line for the current phase. */
  say: (text: string) => void;
  onError?: (err: unknown) => void;
}

interface SpinRun extends Token {
  /** Highest pick index whose round was started. */
  round: number;
  /** A reveal round is mid-animation. */
  running: boolean;
}

export function useReveal(actor: ChairsActor, opts: RevealOptions): void {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    let spin: SpinRun | null = null;
    const o = () => optsRef.current;
    const getEls = (): RevealEls | null => {
      const r = o().els;
      const wrap = r.wrap.current;
      const rider = r.rider.current;
      const spot = r.spot.current;
      const ball = r.ball.current;
      const claw = r.claw.current;
      const banner = r.banner.current;
      return wrap && rider && spot && ball && claw && banner ? { wrap, rider, spot, ball, claw, banner } : null;
    };
    const cells = (): HTMLElement[] => {
      const root = o().grid.current?.root;
      return root ? [...root.querySelectorAll<HTMLElement>('.name')] : [];
    };
    const cellOf = (id: string) => o().grid.current?.getCell(id) ?? null;
    const hideFx = (els: RevealEls) => {
      els.spot.hidden = true;
      els.ball.hidden = true;
      els.claw.hidden = true;
      els.claw.classList.remove('closed');
    };

    /** Clean board (mockup renderChairs). */
    const reset = () => {
      const els = getEls();
      o().grid.current?.root?.classList.remove('focus');
      for (const c of cells()) c.classList.remove(...CELL_FX, 'picked');
      if (!els) return;
      hideFx(els);
      els.rider.hidden = true;
      els.banner.hidden = true;
    };

    /** Spin over (landed or skipped): mark winners, tidy effects (mockup finishSpin). */
    const finish = (run: SpinRun, snap: ChairsSnapshot) => {
      const els = getEls();
      const { picks, method } = snap.context;
      o().grid.current?.root?.classList.remove('focus');
      const keep = new Set(picks.map((p) => p.studentId));
      for (const c of cells()) {
        c.classList.remove('hot', 't1', 't2', 't3', 'flash', 'bump', 'wobble');
        if (keep.has(c.dataset.id ?? '')) {
          c.classList.remove('grabbed');
          c.classList.add('picked');
        }
      }
      if (!els) return;
      els.banner.hidden = true;
      if (run.running) hideFx(els);
      const last = picks[picks.length - 1];
      const lastCell = last ? cellOf(last.studentId) : null;
      if (method === 'chase' && lastCell) moveRider(els, lastCell, 200);
      else els.rider.hidden = true;
    };

    const startRound = (run: SpinRun, snap: ChairsSnapshot) => {
      const { method, picks, pickIndex: idx, fakes } = snap.context;
      const pick = picks[idx];
      const els = getEls();
      if (!method || !pick || !els) return;
      run.round = idx;
      run.running = true;
      els.banner.hidden = true;
      const ctx: RevealCtx = {
        tok: run,
        els,
        audio: o().audio,
        rng: o().rng,
        cells,
        cellOf,
        fake: fakes[idx] ?? false,
        musicOn: () => {
          const s = actor.getSnapshot();
          return !run.dead && phaseOf(s) === 'fast' && s.context.pickIndex === idx;
        },
        fakeout: () => {
          if (!run.dead) actor.send({ type: 'ANIM_FAKEOUT' });
        },
        say: (text) => {
          if (!run.dead) o().say(text);
        },
      };
      METHOD_INFO[method]
        .run(ctx, pick.studentId, idx)
        .catch((e: unknown) => o().onError?.(e))
        .finally(() => {
          run.running = false;
          if (!run.dead) actor.send({ type: 'ANIM_LANDED' });
        });
    };

    const onSnap = (snap: ChairsSnapshot) => {
      const phase = phaseOf(snap);
      const { spinId, method, pickIndex } = snap.context;
      const spinning = SPIN_PHASES.has(phase);
      if (spin && (!spinning || spin.spinId !== spinId)) {
        spin.dead = true;
        finish(spin, snap);
        spin = null;
      }
      if (phase === 'idle' || phase === 'exited') return reset();
      if (!spinning) return;
      if (!spin) {
        reset();
        spin = { dead: false, spinId, pos: null, round: -1, running: false };
        const els = getEls();
        if (els && method)
          void announce(spin, els.banner, method, o().audio, o().rng).catch((e: unknown) => o().onError?.(e));
      }
      if (phase === 'fast' && spin.round < pickIndex) startRound(spin, snap);
    };

    const sub = actor.subscribe(onSnap);
    return () => {
      sub.unsubscribe();
      if (spin) spin.dead = true;
    };
  }, [actor]);
}
