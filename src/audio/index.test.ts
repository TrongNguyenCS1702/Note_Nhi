import { describe, expect, it } from 'vitest';
import { audio, MicError } from './index';

describe('real audio port without Web Audio (jsdom)', () => {
  it('degrades to no-ops instead of throwing', async () => {
    expect(() => {
      audio.ensure();
      audio.sfx('tick');
      audio.step(2);
      audio.roll(1);
      audio.stopMusic({ fadeSec: 1.5 });
    }).not.toThrow();
    expect(await audio.startMusic('calm')).toBe('none');
    const err = await audio.openMic().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MicError);
    expect((err as MicError).kind).toBe('unsupported');
  });

  it('volume clamps and survives mute', () => {
    expect(audio.setVolume(3)).toBe(1);
    audio.setMuted(true);
    expect(audio.setVolume(0.4)).toBe(0.4);
    expect(audio.isMuted()).toBe(true);
    audio.setMuted(false);
    expect(audio.getVolume()).toBe(0.4);
  });

  it('audio layer never touches the database', () => {
    const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true });
    const files = Object.entries(sources).filter(([p]) => !p.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(5);
    for (const [path, src] of files) {
      expect(String(src), path).not.toMatch(/from ['"](dexie|dexie-react-hooks|@\/db\b[^'"]*|\.\.\/db\b[^'"]*)['"]/);
    }
  });
});
