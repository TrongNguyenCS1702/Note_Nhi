import { useSyncExternalStore } from 'react';

// PWA install prompt (SPEC 3.11 step "Cài app ra màn hình"). Chrome fires `beforeinstallprompt`
// early, often before this screen mounts, so we listen from module load (the screen registry
// imports every feature at startup).

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Browser offered an install prompt we can trigger. */
  canPrompt: boolean;
  /** Running as an installed app, or just installed. */
  installed: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, installed: isStandalone() };
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function set(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    set({ canPrompt: false, installed: true });
  });
}

/** Show the browser's install dialog. Returns 'unavailable' when the browser didn't offer one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  set({ canPrompt: false });
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') set({ installed: true });
  return outcome;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
