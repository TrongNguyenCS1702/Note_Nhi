import { describe, expect, it } from 'vitest';
import { createActor, fromCallback } from 'xstate';
import { MIC_HEARD_DBFS, tvCheckMachine, VOLUME_STEP, type TvCheckEvent } from './tvCheck';

function start() {
  const log: string[] = [];
  const machine = tvCheckMachine.provide({
    actions: {
      startMusic: () => void log.push('startMusic'),
      stopMusic: () => void log.push('stopMusic'),
      changeVolume: (_, p) => void log.push(`volume:${p.delta}`),
      enableSafeMargin: () => void log.push('safeMargin'),
      micHeard: () => void log.push('chime'),
      finish: (_, p) => void log.push(p.skipped ? 'finish:skipped' : 'finish:done'),
    },
    actors: {
      mic: fromCallback<TvCheckEvent>(() => {
        log.push('openMic');
        return () => void log.push('closeMic');
      }),
    },
  });
  const actor = createActor(machine).start();
  return { actor, log };
}

describe('tvCheck machine', () => {
  it('starts on the speaker step playing music; arrows change volume', () => {
    const { actor, log } = start();
    expect(actor.getSnapshot().value).toBe('speaker');
    actor.send({ type: 'VOLUME_UP' });
    actor.send({ type: 'VOLUME_DOWN' });
    expect(log).toEqual(['startMusic', `volume:${VOLUME_STEP}`, `volume:${-VOLUME_STEP}`]);
  });

  it('walks speaker → corners → mic → done', () => {
    const { actor, log } = start();
    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().value).toBe('corners');
    expect(log).toContain('stopMusic');
    actor.send({ type: 'CROPPED' });
    expect(actor.getSnapshot().context.cropped).toBe(true);
    expect(actor.getSnapshot().value).toBe('corners'); // asks again
    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().value).toEqual({ mic: { active: 'opening' } });
    actor.send({ type: 'MIC_READY' });
    actor.send({ type: 'MIC_LEVEL', dbfs: -60 });
    expect(actor.getSnapshot().value).toEqual({ mic: { active: 'listening' } });
    expect(log).not.toContain('chime');
    actor.send({ type: 'MIC_LEVEL', dbfs: MIC_HEARD_DBFS + 5 });
    expect(actor.getSnapshot().value).toEqual({ mic: { active: 'heard' } });
    actor.send({ type: 'MIC_LEVEL', dbfs: -10 });
    expect(log.filter((l) => l === 'chime')).toHaveLength(1);
    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().status).toBe('done');
    expect(log).toContain('closeMic');
    expect(log).toContain('finish:done');
  });

  it('mic denied → failed with instructions, retry reopens', () => {
    const { actor, log } = start();
    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });
    actor.send({ type: 'MIC_ERROR', kind: 'denied' });
    expect(actor.getSnapshot().value).toEqual({ mic: 'failed' });
    expect(log.at(-1)).toBe('closeMic');
    expect(actor.getSnapshot().context.micError).toBe('denied');
    actor.send({ type: 'RETRY_MIC' });
    expect(actor.getSnapshot().value).toEqual({ mic: { active: 'opening' } });
    expect(actor.getSnapshot().context.micError).toBeNull();
    expect(log.filter((l) => l === 'openMic')).toHaveLength(2);
    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().status).toBe('done');
  });

  it('Esc skips from any step and cleans up', () => {
    const a = start();
    a.actor.send({ type: 'SKIP' });
    expect(a.actor.getSnapshot().value).toBe('skipped');
    expect(a.log).toEqual(['startMusic', 'stopMusic', 'finish:skipped']);

    const b = start();
    b.actor.send({ type: 'NEXT' });
    b.actor.send({ type: 'NEXT' });
    b.actor.send({ type: 'SKIP' });
    expect(b.log).toContain('closeMic');
    expect(b.log).toContain('finish:skipped');
  });

  it('ignores keys that do not belong to the current step', () => {
    const { actor, log } = start();
    actor.send({ type: 'CROPPED' });
    expect(actor.getSnapshot().context.cropped).toBe(false);
    actor.send({ type: 'NEXT' });
    actor.send({ type: 'VOLUME_UP' });
    expect(log.filter((l) => l.startsWith('volume'))).toHaveLength(0);
  });
});
