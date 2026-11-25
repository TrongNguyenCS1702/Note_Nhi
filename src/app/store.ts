import { useEffect, useRef } from 'react';
import { create } from 'zustand';

export const SCREEN_IDS = [
  'welcome',
  'check',
  'home',
  'prep',
  'launch',
  'chairs',
  'silence',
  'wait',
  'classes',
  'music',
  'settings',
] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

/** Where "back" (Esc / Backspace fallback) goes from each screen (SPEC 2). */
export const PARENT_SCREEN: Readonly<Partial<Record<ScreenId, ScreenId>>> = {
  check: 'home',
  prep: 'home',
  launch: 'home',
  chairs: 'launch',
  silence: 'launch',
  wait: 'launch',
  classes: 'home',
  music: 'home',
  settings: 'home',
};

/** Screens where letters are typed (class names) and the class pill/wake lock are off. */
export const isTypingScreen = (s: ScreenId): boolean => s === 'home' || s === 'welcome';

export interface OpenClassOptions {
  /** Pill text in the app bar, e.g. "Lớp 3A". Defaults to `Lớp <classId>`. */
  label?: string;
  /** Screen to land on (default `prep`; use `launch` when already checked in today, `check` on first lesson). */
  screen?: ScreenId;
}

export interface AppState {
  screen: ScreenId;
  classId: string | null;
  classLabel: string | null;
  muted: boolean;
  /** "Lề an toàn TV": adds `body.safe`. */
  safeMargin: boolean;
  go: (screen: ScreenId) => void;
  /** Select a class and navigate. Call `enterFullscreen()` yourself in the same click/key handler (needs a gesture). */
  openClass: (classId: string, opts?: OpenClassOptions) => void;
  /** Go to the parent screen. Returns false when there is none (home/welcome). */
  back: () => boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setSafeMargin: (on: boolean) => void;
}

export const initialAppState = {
  screen: 'home' as ScreenId,
  classId: null as string | null,
  classLabel: null as string | null,
  muted: false,
  safeMargin: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialAppState,
  go: (screen) => set({ screen }),
  openClass: (classId, opts) =>
    set({ classId, classLabel: opts?.label ?? `Lớp ${classId}`, screen: opts?.screen ?? 'prep' }),
  back: () => {
    const parent = PARENT_SCREEN[get().screen];
    if (!parent) return false;
    set({ screen: parent });
    return true;
  },
  setMuted: (muted) => set({ muted }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setSafeMargin: (safeMargin) => set({ safeMargin }),
}));

/** Subscribe to mute changes outside React (audio layer). Returns unsubscribe. */
export function onMuteChange(cb: (muted: boolean) => void): () => void {
  return useAppStore.subscribe((s, prev) => {
    if (s.muted !== prev.muted) cb(s.muted);
  });
}

/** Hook form of `onMuteChange`; also calls `cb` once with the current value on mount. */
export function useMuteChange(cb: (muted: boolean) => void): void {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => {
    ref.current(useAppStore.getState().muted);
    return onMuteChange((m) => ref.current(m));
  }, []);
}
