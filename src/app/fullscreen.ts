import { toast } from '@/ui/toastStore';

// Fullscreen + Escape keyboard lock (SPEC 3.10): while locked, a short Esc press reaches the app ("back")
// and holding Esc ~2s exits fullscreen. Without Keyboard Lock support, Backspace acts as "back" (see keyboard.ts).

interface KeyboardLockApi {
  lock(keyCodes?: string[]): Promise<void>;
  unlock(): void;
}

function keyboardApi(): KeyboardLockApi | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard;
}

export function isFullscreenSupported(): boolean {
  return typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function';
}

export function isKeyboardLockSupported(): boolean {
  return typeof keyboardApi()?.lock === 'function';
}

export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenElement != null;
}

/**
 * Enter fullscreen and lock Escape. Must be called synchronously inside a user gesture
 * (click / keydown handler) — `requestFullscreen()` is invoked before any await.
 * Resolves true when fullscreen is active.
 */
export function enterFullscreen(el: Element = document.documentElement): Promise<boolean> {
  if (!isFullscreenSupported()) return Promise.resolve(false);
  let request: Promise<void>;
  try {
    request = isFullscreen() ? Promise.resolve() : el.requestFullscreen();
  } catch {
    return Promise.resolve(false);
  }
  return request.then(
    async () => {
      try {
        await keyboardApi()?.lock(['Escape']);
      } catch {
        // unsupported / denied: Backspace fallback handles "back"
      }
      return true;
    },
    () => false,
  );
}

export async function exitFullscreen(): Promise<void> {
  try {
    keyboardApi()?.unlock();
  } catch {
    // ignore
  }
  if (isFullscreen()) {
    try {
      await document.exitFullscreen();
    } catch {
      // ignore
    }
  }
}

/** Toggle; resolves to whether fullscreen is now active. Call inside a user gesture. */
export function toggleFullscreen(): Promise<boolean> {
  if (isFullscreen()) return exitFullscreen().then(() => false);
  return enterFullscreen();
}

/** Toggle from the F key / app bar button; toasts when the browser refuses fullscreen (mockup `toggleFS`). */
export function toggleFullscreenLoud(): Promise<boolean> {
  if (isFullscreen()) return exitFullscreen().then(() => false);
  return enterFullscreen().then((on) => {
    if (!on) toast('Trình duyệt này không cho bật toàn màn hình');
    return on;
  });
}
