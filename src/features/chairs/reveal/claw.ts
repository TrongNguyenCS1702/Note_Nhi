// Kiểu 4: Máy gắp thú — the claw runs left/right, slows over the winner's column, drops row by
// row, grabs, lifts and wobbles; fake-out = stop one row above, then "xuống thêm 1 hàng".
import { ctr, easeOut, fakeOut, freeCells, landOn, sleep, tween, type RevealCtx } from './common';

const CLAW_HALF_W = 35;
const CLAW_SPEED_PX_S = 620;

export async function runClaw(ctx: RevealCtx, studentId: string): Promise<void> {
  const { tok, els, rng } = ctx;
  const target = ctx.cellOf(studentId);
  const cells = freeCells(ctx);
  if (!target || cells.length === 0) return;
  const claw = els.claw;
  const cw = target.offsetWidth;
  const xs = cells.map((c) => ctr(c).x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let x = minX + rng() * (maxX - minX);
  let len = 6;
  let dir = rng() < 0.5 ? 1 : -1;
  const set = () => {
    claw.style.transform = `translateX(${x - CLAW_HALF_W}px)`;
    claw.style.setProperty('--len', `${len}px`);
  };
  claw.classList.remove('closed');
  claw.hidden = false;
  set();

  await new Promise<void>((res) => {
    let last = performance.now();
    const f = (now: number) => {
      if (tok.dead || !ctx.musicOn()) return res();
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
      last = now;
      x += dir * CLAW_SPEED_PX_S * dt;
      if (x > maxX) {
        x = maxX;
        dir = -1;
      }
      if (x < minX) {
        x = minX;
        dir = 1;
      }
      set();
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  if (tok.dead) return;

  const tx = ctr(target).x;
  let a = x;
  const over = Math.max(minX, Math.min(maxX, tx + dir * cw * 0.7));
  await tween(
    tok,
    1700,
    (e) => {
      x = a + (over - a) * e;
      set();
    },
    easeOut,
  );
  if (tok.dead) return;
  ctx.audio.step(2);
  await sleep(300);
  if (tok.dead) return;
  a = x;
  await tween(tok, 650, (e) => {
    x = a + (tx - a) * e;
    set();
  });
  if (tok.dead) return;
  ctx.audio.step(4);
  ctx.say('Gắp xuống nè…');

  const column = cells.filter((c) => Math.abs(ctr(c).x - tx) < cw / 2).sort((p, q) => p.offsetTop - q.offsetTop);
  const ti = column.indexOf(target);
  const fake = ti > 0 && ctx.fake;
  const lenFor = (c: HTMLElement) => c.offsetTop + c.offsetHeight * 0.5 - 56 + 34;
  for (let i = 0; i <= ti; i++) {
    const row = column[i];
    if (!row) break;
    const l0 = len;
    const l1 = lenFor(row);
    await tween(tok, 520, (e) => {
      len = l0 + (l1 - l0) * e;
      set();
    });
    if (tok.dead) return;
    ctx.audio.step(9 - i);
    if (i < ti) {
      if (fake && i === ti - 1) {
        await fakeOut(ctx);
        if (tok.dead) return;
        ctx.audio.sfx('boing');
        ctx.say('Ơ! Xuống thêm 1 hàng!');
      } else {
        await sleep(250);
        if (tok.dead) return;
      }
    }
  }

  claw.classList.add('closed');
  ctx.audio.sfx('tick');
  await sleep(380);
  if (tok.dead) return;
  target.classList.add('grabbed');
  const l0 = len;
  await tween(
    tok,
    500,
    (e) => {
      len = l0 - 26 * e;
      set();
    },
    easeOut,
  );
  if (tok.dead) return;
  ctx.say('Gắp được rồi… có rơi không ta?');
  target.classList.add('wobble');
  ctx.audio.roll(0.7);
  await sleep(800);
  target.classList.remove('wobble');
  if (tok.dead) return;
  await landOn(ctx, target);
}
