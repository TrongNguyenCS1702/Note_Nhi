import { useEffect, useRef } from 'react';
import { isKeyboardLockSupported, toggleFullscreenLoud } from './fullscreen';
import { isTypingScreen, useAppStore, type ScreenId } from './store';

/**
 * Screen key handler. `key` is `KeyboardEvent.key` ("Escape", " ", "ArrowUp", "a"…).
 * Return true when handled → the dispatcher calls preventDefault and stops.
 * With the Backspace fallback active, Backspace arrives here as key "Escape" (e.key stays "Backspace").
 */
export type ScreenKeyHandler = (key: string, e: KeyboardEvent) => boolean | void;
export type KeyUpHandler = (key: string, e: KeyboardEvent) => void;

export interface ScreenKeyOptions {
  /** Keys whose auto-repeat this handler wants (e.g. hold keys). Letters match case-insensitively. */
  repeatKeys?: readonly string[];
  /** Higher runs first; equal priority → most recently registered first. Default 0. */
  priority?: number;
}

interface Entry {
  handler: ScreenKeyHandler;
  repeatKeys: ReadonlySet<string>;
  priority: number;
  order: number;
}

const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);

let downEntries: Entry[] = [];
let upEntries: KeyUpHandler[] = [];
let counter = 0;

/** Non-hook registration (returns unregister). Prefer `useScreenKeys` in components. */
export function registerScreenKeys(handler: ScreenKeyHandler, opts: ScreenKeyOptions = {}): () => void {
  const entry: Entry = {
    handler,
    repeatKeys: new Set((opts.repeatKeys ?? []).map(norm)),
    priority: opts.priority ?? 0,
    order: ++counter,
  };
  downEntries = [...downEntries, entry].sort((a, b) => b.priority - a.priority || b.order - a.order);
  return () => {
    downEntries = downEntries.filter((e) => e !== entry);
  };
}

export function registerKeyUp(handler: KeyUpHandler): () => void {
  upEntries = [...upEntries, handler];
  return () => {
    upEntries = upEntries.filter((h) => h !== handler);
  };
}

/**
 * Register keys for the lifetime of the component. The latest `handler` is always used (no stale closures).
 * @example
 * useScreenKeys((k) => {
 *   if (k === ' ') { send({ type: 'SPACE' }); return true; }
 *   if (k === 'Escape') { send({ type: 'BACK' }); return true; }
 *   if (k === 'n' || k === 'N') { setNoisy(true); return true; }
 * }, { repeatKeys: ['n'] });
 */
export function useScreenKeys(handler: ScreenKeyHandler, opts: ScreenKeyOptions = {}): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const repeatSig = (opts.repeatKeys ?? []).join('\u0000');
  const priority = opts.priority ?? 0;
  useEffect(
    () =>
      registerScreenKeys((k, e) => ref.current(k, e), {
        repeatKeys: repeatSig ? repeatSig.split('\u0000') : [],
        priority,
      }),
    [repeatSig, priority],
  );
}

/** Key-up listener for hold keys (e.g. release "N"). Same input/modifier filtering as keydown. */
export function useKeyUp(handler: KeyUpHandler): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => registerKeyUp((k, e) => ref.current(k, e)), []);
}

export interface KeyboardDeps {
  getScreen: () => ScreenId;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  /** Navigate to the parent screen; false when there is none. */
  back: () => boolean;
  isKeyboardLockSupported: () => boolean;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') != null;
}

function runHandlers(key: string, e: KeyboardEvent): boolean {
  for (const entry of downEntries) {
    if (entry.handler(key, e) === true) return true;
  }
  return false;
}

/** Core keydown rules (exported for tests). Returns true when the key was consumed. */
export function dispatchKeyDown(e: KeyboardEvent, deps: KeyboardDeps): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isEditableTarget(e.target)) {
    if (e.key === 'Escape' && e.target instanceof HTMLElement) e.target.blur();
    return false;
  }
  const key = e.key;
  if (e.repeat && !downEntries.some((d) => d.repeatKeys.has(norm(key)))) return false;

  const screen = deps.getScreen();
  const consume = () => {
    e.preventDefault();
    return true;
  };

  // F / M are global except where letters type class names
  if (!isTypingScreen(screen)) {
    const k = norm(key);
    if (k === 'f') {
      deps.toggleFullscreen();
      return consume();
    }
    if (k === 'm') {
      deps.toggleMute();
      return consume();
    }
  }

  if (runHandlers(key, e)) return consume();

  // Backspace = "back" when Escape can't be locked in fullscreen (never on home/welcome)
  const backspaceAsBack = key === 'Backspace' && !isTypingScreen(screen) && !deps.isKeyboardLockSupported();
  if (backspaceAsBack && runHandlers('Escape', e)) return consume();

  if ((key === 'Escape' || backspaceAsBack) && deps.back()) return consume();
  return false;
}

export function dispatchKeyUp(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isEditableTarget(e.target)) return;
  for (const h of upEntries) h(e.key, e);
}

/** Default wiring to the app store + fullscreen helpers. */
export function defaultKeyboardDeps(): KeyboardDeps {
  return {
    getScreen: () => useAppStore.getState().screen,
    toggleMute: () => useAppStore.getState().toggleMute(),
    back: () => useAppStore.getState().back(),
    isKeyboardLockSupported,
    toggleFullscreen: () => void toggleFullscreenLoud(),
  };
}

/** Attach the global dispatcher (App does this once). Returns detach. */
export function installKeyboard(deps: KeyboardDeps = defaultKeyboardDeps(), target: Document = document): () => void {
  const down = (e: KeyboardEvent) => void dispatchKeyDown(e, deps);
  const up = (e: KeyboardEvent) => dispatchKeyUp(e);
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}

/** Test helper: drop all registrations. */
export function resetKeyboardRegistry(): void {
  downEntries = [];
  upEntries = [];
}
