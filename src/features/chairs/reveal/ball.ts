// Kiểu 3: Bóng nảy — a ♪ ball hops between nearby cells (the hit cell squashes); slowing down the
// hops get lower and head for the winner; fake-out = land on the neighbour then roll over.
import {
  ctr,
  dist,
  fakeOut,
  freeCells,
  landOn,
  linear,
  nearestTo,
  pickOne,
  retrigger,
  tween,
  type Pt,
  type RevealCtx,
} from './common';

const HOP_HEIGHTS = [120, 96, 78, 62, 48, 36, 26, 18, 12];

export async function runBall(ctx: RevealCtx, studentId: string): Promise<void> {
  const { tok, els, rng } = ctx;
  const target = ctx.cellOf(studentId);
  const cells = freeCells(ctx);
  const first = pickOne(rng, cells);
  if (!target || !first) return;
  const ball = els.ball;
  const cw = target.offsetWidth;
  const top = (c: HTMLElement): Pt => ({ x: ctr(c).x, y: c.offsetTop - 20 });
  let cur = first;
  let pos = top(cur);
  const setB = (q: Pt) => {
    pos = q;
    ball.style.transform = `translate(${q.x}px, ${q.y}px)`;
  };
  const hop = async (to: HTMLElement, h: number, ms: number) => {
    const a = pos;
    const b = top(to);
    await tween(
      tok,
      ms,
      (_e, t) => setB({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - h * 4 * t * (1 - t) }),
      linear,
    );
    if (tok.dead) return;
    cur = to;
    retrigger(to, 'bump');
  };
  ball.hidden = false;
  setB(pos);

  while (!tok.dead && ctx.musicOn()) {
    const opts = cells.filter((c) => c !== cur && dist(c, cur) < cw * 2.4);
    await hop(pickOne(rng, opts.length ? opts : cells) ?? target, 70, 300);
  }
  if (tok.dead) return;

  let n = 0;
  const hopSlow = async (to: HTMLElement) => {
    await hop(to, HOP_HEIGHTS[Math.min(n, HOP_HEIGHTS.length - 1)] ?? 12, 420 + n * 60);
    if (!tok.dead) ctx.audio.step(n * 2 + 1);
    n++;
  };
  const near = nearestTo(target, cells);
  const fake = !!near && ctx.fake;
  const end = fake && near ? near : target;
  for (let k = 0; k < 2 && !tok.dead; k++) {
    const opts = cells.filter((c) => c !== cur && c !== end && dist(c, cur) < cw * 2.4);
    const next = pickOne(rng, opts);
    if (next) await hopSlow(next);
  }
  let guard = 0;
  while (!tok.dead && cur !== end && guard++ < 14) {
    const dEnd = dist(cur, end);
    let opts = cells.filter((c) => c !== cur && dist(c, cur) < cw * 2.4 && dist(c, end) < dEnd);
    if (opts.includes(end) && (dEnd < cw * 1.6 || opts.length === 1)) opts = [end];
    else opts = opts.filter((c) => c !== end);
    await hopSlow(pickOne(rng, opts) ?? end);
  }
  if (tok.dead) return;
  if (cur !== end) {
    await hopSlow(end);
    if (tok.dead) return;
  }
  if (fake) {
    await fakeOut(ctx);
    if (tok.dead) return;
    await hop(target, 26, 380);
    if (tok.dead) return;
    ctx.audio.sfx('boing');
    ctx.say('Ơ! Bóng lăn sang bên cạnh!');
  }
  await landOn(ctx, target);
}
