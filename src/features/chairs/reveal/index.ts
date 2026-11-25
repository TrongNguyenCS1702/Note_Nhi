import type { AudioPort } from '@/audio/types';
import type { CallMethod } from '@/domain/schemas';
import { INTRO_HOLD_MS, INTRO_TICKS_MS } from '@/machines/chairs';
import { runBall } from './ball';
import { runChase } from './chase';
import { runClaw } from './claw';
import { retrigger, shuffle, sleep, type RevealRun, type Token } from './common';
import { runSpot } from './spot';

export interface MethodInfo {
  name: string;
  /** Bubble while the music plays (1st round). */
  fastMsg: string;
  /** Bubble once the music stops. */
  slowMsg: string;
  run: RevealRun;
}

export const METHOD_INFO: Record<CallMethod, MethodInfo> = {
  chase: {
    name: 'Đèn chạy',
    fastMsg: 'Nhạc nè! ♪ ♫ Bấm Space để dừng nhạc!',
    slowMsg: 'Nhạc dừng! Chậm dần… chậm dần…',
    run: runChase,
  },
  spot: {
    name: 'Đèn sân khấu',
    fastMsg: 'Đèn sân khấu đi tìm ca sĩ! Bấm Space để dừng nhạc',
    slowMsg: 'Đèn chậm dần… chậm dần…',
    run: runSpot,
  },
  ball: {
    name: 'Bóng nảy',
    fastMsg: 'Bóng nảy tưng tưng! Bấm Space để dừng nhạc',
    slowMsg: 'Bóng nảy chậm dần…',
    run: runBall,
  },
  claw: {
    name: 'Máy gắp thú',
    fastMsg: 'Máy gắp thú chạy nè! Bấm Space để dừng nhạc',
    slowMsg: 'Máy gắp chậm lại… cột nào đây?',
    run: runClaw,
  },
};

/** Method banner: flicks through the names with ticks, lands on the chosen one with a chime. */
export async function announce(
  tok: Token,
  banner: HTMLElement,
  method: CallMethod,
  audio: AudioPort,
  rng: () => number,
): Promise<void> {
  banner.hidden = false;
  banner.classList.remove('pop');
  const names = shuffle(
    rng,
    Object.values(METHOD_INFO).map((m) => m.name),
  );
  for (let i = 0; i < INTRO_TICKS_MS.length; i++) {
    banner.textContent = names[i % names.length] ?? '';
    audio.sfx('tick');
    await sleep(INTRO_TICKS_MS[i] ?? 0);
    if (tok.dead) return;
  }
  banner.textContent = METHOD_INFO[method].name;
  retrigger(banner, 'pop');
  audio.sfx('chime');
  await sleep(INTRO_HOLD_MS);
  if (!tok.dead) banner.hidden = true;
}

export { moveRider } from './chase';
export { CELL_FX, type RevealCtx, type RevealEls, type Token } from './common';
