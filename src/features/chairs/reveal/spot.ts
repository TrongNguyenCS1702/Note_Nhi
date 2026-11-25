// Kiểu 2: Đèn sân khấu — the grid darkens, a ring of light glides between cells looking for the
// "singer"; slowing down it circles closer; fake-out = stop on the neighbour then slide over.
import {
  ctr,
  dist,
  easeOut,
  fakeOut,
  freeCells,
  landOn,
  nearestTo,
  pickOne,
  sleep,
  tween,
  type Pt,
  type RevealCtx,
} from './common';

const SPOT_PAD = 24; // .spot has inset:-24px

export async function runSpot(ctx: RevealCtx, studentId: string): Promise<void> {
  const { tok, els, rng } = ctx;
  const target = ctx.cellOf(studentId);
  const cells = freeCells(ctx);
  const startCell = pickOne(rng, cells);
  if (!target || !startCell) return;
  const sp = els.spot;
  const cw = target.offsetWidth;
  let p: Pt = ctr(startCell);
  let r = 130;
  let at: HTMLElement | null = null;
  const set = () => {
    sp.style.setProperty('--x', `${p.x + SPOT_PAD}px`);
    sp.style.setProperty('--y', `${p.y + SPOT_PAD}px`);
    sp.style.setProperty('--r', `${r}px`);
  };
  const dp = (c: HTMLElement) => {
    const q = ctr(c);
    return Math.hypot(q.x - p.x, q.y - p.y);
  };
  const glide = (to: HTMLElement, ms: number, ease?: (t: number) => number) => {
    const a = { ...p };
    const b = ctr(to);
    return tween(
      tok,
      ms,
      (e) => {
        p = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
        set();
      },
      ease,
    );
  };
  sp.hidden = false;
  set();

  while (!tok.dead && ctx.musicOn()) {
    const opts = cells.filter((c) => c !== at && dp(c) > 120 && dp(c) < 520);
    at = pickOne(rng, opts.length ? opts : cells) ?? target;
    await glide(at, Math.max(280, dp(at) / 1.1));
  }
  if (tok.dead) return;

  for (let i = 0; i < 3; i++) {
    const opts = cells.filter(
      (c) => c !== target && dist(c, target) > cw * 0.6 && dist(c, target) < cw * (3.2 - i * 0.8),
    );
    const next = pickOne(rng, opts);
    if (!next) break;
    await glide(next, 800 + i * 280);
    if (tok.dead) return;
    ctx.audio.step(i * 3 + 1);
    await sleep(120 + i * 110);
    if (tok.dead) return;
  }

  const near = nearestTo(target, cells);
  if (near && ctx.fake) {
    await glide(near, 1000);
    if (tok.dead) return;
    ctx.audio.step(8);
    await fakeOut(ctx);
    if (tok.dead) return;
    await glide(target, 450);
    ctx.audio.sfx('boing');
    ctx.say('Ơ! Đèn trượt sang bên cạnh!');
  } else {
    await glide(target, 1500, easeOut);
    ctx.audio.step(9);
  }
  if (tok.dead) return;
  await tween(
    tok,
    450,
    (e) => {
      r = 130 - 22 * e;
      set();
    },
    easeOut,
  );
  if (tok.dead) return;
  await landOn(ctx, target);
}
