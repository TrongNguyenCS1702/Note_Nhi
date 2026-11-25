// Public entry of the audio layer. Screens import `audio` (or take an `AudioPort` for tests).
import { ensureAudio, getVolume, isMuted, setMuted, setVolume } from './context';
import { openMic } from './micMeter';
import { startMusic, stopMusic } from './music';
import { roll, sfx, step } from './synth';
import type { AudioPort } from './types';

export const audio: AudioPort = {
  ensure: () => void ensureAudio(),
  startMusic: (mood, tracks) => startMusic(mood, tracks),
  stopMusic,
  sfx,
  step,
  roll,
  getVolume,
  setVolume,
  isMuted,
  setMuted,
  openMic,
};

export { dbfsToPercent, METER_MAX_DBFS, METER_MIN_DBFS } from './micMeter';
export * from './types';
