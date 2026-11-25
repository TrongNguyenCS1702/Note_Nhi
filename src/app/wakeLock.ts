import { useEffect } from 'react';

/**
 * Keep the screen awake while `active` (SPEC 3.10: every screen except home/welcome).
 * Re-acquires when the tab becomes visible again (the browser drops the lock when hidden).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    let pending = false;

    const acquire = async () => {
      if (disposed || pending || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      pending = true;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (disposed) void s.release().catch(() => {});
        else sentinel = s;
      } catch {
        // denied (battery saver, unsupported context) — nothing else to do
      } finally {
        pending = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
    };
  }, [active]);
}
