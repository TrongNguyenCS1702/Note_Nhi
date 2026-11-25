import { audio } from '@/audio';
import { getDevicePrefs, isEmpty, logError, seedDefaultFunChallenges } from '@/db';
import { onMuteChange, useAppStore } from './store';

/** One-time wiring between shell, database and audio. Returns an unsubscribe (for tests). */
export async function bootstrap(): Promise<() => void> {
  const store = useAppStore.getState();
  try {
    const [empty, device] = await Promise.all([isEmpty(), getDevicePrefs()]);
    await seedDefaultFunChallenges();
    audio.setVolume(device.volume);
    audio.setMuted(device.muted);
    store.setMuted(device.muted);
    store.setSafeMargin(device.tvSafeMargin);
    if (empty) store.go('welcome');
  } catch (e) {
    void logError({ screen: 'bootstrap', message: String(e) });
  }
  return onMuteChange((m) => audio.setMuted(m));
}
