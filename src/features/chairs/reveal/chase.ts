// Kiểu 1: Đèn chạy — light runs in snake order (odd rows L→R, even rows R→L) with a 3-cell comet
// tail and Nốt Nhí riding on it; slows over ≥14 pentatonic steps; fake-out = stop one cell early.
import { landOn, sleep, type RevealCtx, type RevealEls } from './common';

const ROW_TOLERANCE_PX = 12;

export function snakeOrder(cells: readonly HTMLElement[]): HTMLElement[] {
  const rows: Array<{ top: number; cells: HTMLElement[] }> = [];
  for (const c of cells) {
    let r = rows.find((x) => Math.abs(x.top - c.offsetTop) < ROW_TOLERANCE_PX);
    if (!r) {
      r = { top: c.offsetTop, cells: [] };
      rows.push(r);
    }
    r.cells.push(c);
  }
  rows.sort((a, b) => a.top - b.top);
  return rows.flatMap((r, i) => {
    r.cells.sort((a, b) => a.offsetLeft - b.offsetLeft);
    return i % 2 ? r.cells.reverse() : r.cells;
  });
}

export function moveRider(els: RevealEls, cell: HTMLElement, ms: number): void {
  const r = els.rider;
  const first = r.hidden;
  r.hidden = false;
  const x = cell.offsetLeft + cell.offsetWidth / 2 - r.offsetWidth / 2;
  const y = cell.offsetTop - r.offsetHeight * 0.72;
  r.style.transitionDuration = first ? '0ms' : `${Math.min(ms, 260)}ms`;
  r.style.transform = `translate(${x}px, ${y}px)`;
}

function light(els: RevealEls, order: readonly HTMLElement[], pos: number, ms: number): void {
  const N = order.length;
  const c = order[pos];
  if (!c) return;
  for (const el of order) el.classList.remove('hot', 't1', 't2', 't3');
  if (!c.classList.contains('picked')) c.classList.add('hot');
  for (let k = 1; k <= 3; k++) {
    const t = order[(pos - k + N * 4) % N];
    if (t && t !== c && !t.classList.contains('picked')) t.classList.add(`t${k}`);
  }
  moveRider(els, c, ms);
}

export async function runChase(ctx: RevealCtx, studentId: string): Promise<void> {
  const { tok, els } = ctx;
  const grid = els.wrap.querySelector<HTMLElement>('.names');
  const order = snakeOrder(ctx.cells());
  const N = order.length;
  const w = order.findIndex((c) => c.dataset.id === studentId);
  if (N === 0 || w < 0) return;
  let pos = tok.pos ?? Math.floor(ctx.rng() * N);

  // 1) Nhạc chạy: đèn tăng tốc rồi chạy đều, có đuôi sao chổi, Nốt Nhí cưỡi đèn
  for (let s = 0; ; s++) {
    const ms = Math.max(85, 240 - s * 22);
    light(els, order, pos, ms);
    await sleep(ms);
    if (tok.dead) return;
    if (!ctx.musicOn()) break;
    pos = (pos + 1) % N;
  }

  // 2) Nhạc tắt: đèn chậm dần, mỗi bước là một nốt ngũ cung
  grid?.classList.add('focus');
  const before = order[(w - 1 + N) % N];
  const fake = ctx.fake && N > 2 && !!before && !before.classList.contains('picked');
  const stopAt = fake ? (w - 1 + N) % N : w;
  let dist = (stopAt - pos + N) % N;
  while (dist < 14) dist += N;
  for (let i = 1; i <= dist; i++) {
    pos = (pos + 1) % N;
    const ms = 90 * Math.pow(680 / 90, i / dist);
    light(els, order, pos, ms);
    ctx.audio.step(i);
    await sleep(ms);
    if (tok.dead) return;
  }

  // 3) Cú lừa: dừng trước 1 ô, trống dồn… rồi nhích thêm 1 bước
  if (fake) {
    ctx.fakeout();
    await sleep(1450);
    if (tok.dead) return;
    pos = (pos + 1) % N;
    light(els, order, pos, 200);
    ctx.audio.sfx('boing');
    ctx.say('Ơ! Nhích thêm 1 bước!');
    await sleep(800);
    if (tok.dead) return;
  }

  // 4) Ô trúng nháy sáng
  const hit = order[pos];
  if (!hit) return;
  await landOn(ctx, hit);
  if (tok.dead) return;
  for (const el of order) el.classList.remove('hot', 't1', 't2', 't3');
  grid?.classList.remove('focus');
  tok.pos = pos;
}
