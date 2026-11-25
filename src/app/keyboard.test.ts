import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchKeyDown,
  dispatchKeyUp,
  registerKeyUp,
  registerScreenKeys,
  resetKeyboardRegistry,
  type KeyboardDeps,
} from './keyboard';
import type { ScreenId } from './store';

function makeDeps(screen: ScreenId, lock = true) {
  return {
    getScreen: () => screen,
    toggleFullscreen: vi.fn(),
    toggleMute: vi.fn(),
    back: vi.fn(() => screen !== 'home' && screen !== 'welcome'),
    isKeyboardLockSupported: () => lock,
  } satisfies KeyboardDeps;
}

function key(k: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

beforeEach(resetKeyboardRegistry);
afterEach(() => {
  resetKeyboardRegistry();
  document.body.innerHTML = '';
});

describe('keyboard dispatcher', () => {
  it('passes keys to the screen handler and preventDefaults when handled', () => {
    const handler = vi.fn((k: string) => k === ' ');
    registerScreenKeys(handler);
    const space = key(' ');
    expect(dispatchKeyDown(space, makeDeps('chairs'))).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    const x = key('x');
    expect(dispatchKeyDown(x, makeDeps('chairs'))).toBe(false);
    expect(x.defaultPrevented).toBe(false);
  });

  it('ignores keys typed into inputs, textareas and contenteditable', () => {
    const handler = vi.fn(() => true);
    registerScreenKeys(handler);
    const deps = makeDeps('chairs');
    const input = document.createElement('input');
    const ta = document.createElement('textarea');
    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    ce.appendChild(inner);
    document.body.append(input, ta, ce);
    for (const t of [input, ta, inner]) {
      expect(dispatchKeyDown(key('f', {}, t), deps)).toBe(false);
      expect(dispatchKeyDown(key(' ', {}, t), deps)).toBe(false);
    }
    expect(handler).not.toHaveBeenCalled();
    expect(deps.toggleFullscreen).not.toHaveBeenCalled();
  });

  it('Escape inside an input blurs it', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    dispatchKeyDown(key('Escape', {}, input), makeDeps('prep'));
    expect(document.activeElement).not.toBe(input);
  });

  it('ignores ctrl/meta/alt combos', () => {
    const handler = vi.fn(() => true);
    registerScreenKeys(handler);
    const deps = makeDeps('launch');
    expect(dispatchKeyDown(key('f', { ctrlKey: true }), deps)).toBe(false);
    expect(dispatchKeyDown(key('1', { altKey: true }), deps)).toBe(false);
    expect(dispatchKeyDown(key('m', { metaKey: true }), deps)).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(deps.toggleFullscreen).not.toHaveBeenCalled();
  });

  it('F and M toggle fullscreen/mute on game screens, before screen handlers', () => {
    const handler = vi.fn(() => true);
    registerScreenKeys(handler);
    const deps = makeDeps('chairs');
    dispatchKeyDown(key('F'), deps);
    dispatchKeyDown(key('m'), deps);
    expect(deps.toggleFullscreen).toHaveBeenCalledTimes(1);
    expect(deps.toggleMute).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('F and M go to the screen handler on home and welcome (typing class names)', () => {
    for (const screen of ['home', 'welcome'] as const) {
      resetKeyboardRegistry();
      const typed: string[] = [];
      registerScreenKeys((k) => {
        typed.push(k);
        return true;
      });
      const deps = makeDeps(screen);
      dispatchKeyDown(key('f'), deps);
      dispatchKeyDown(key('M'), deps);
      expect(typed).toEqual(['f', 'M']);
      expect(deps.toggleFullscreen).not.toHaveBeenCalled();
      expect(deps.toggleMute).not.toHaveBeenCalled();
    }
  });

  it('drops auto-repeat unless a handler opted into that key', () => {
    const handler = vi.fn(() => true);
    registerScreenKeys(handler, { repeatKeys: ['n'] });
    const deps = makeDeps('silence');
    expect(dispatchKeyDown(key(' ', { repeat: true }), deps)).toBe(false);
    expect(dispatchKeyDown(key('f', { repeat: true }), deps)).toBe(false);
    expect(deps.toggleFullscreen).not.toHaveBeenCalled();
    expect(dispatchKeyDown(key('N', { repeat: true }), deps)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('higher priority / later registrations run first', () => {
    const calls: string[] = [];
    registerScreenKeys(() => {
      calls.push('screen');
      return true;
    });
    const off = registerScreenKeys(() => {
      calls.push('overlay');
      return true;
    });
    dispatchKeyDown(key('Escape'), makeDeps('chairs'));
    off();
    registerScreenKeys(
      () => {
        calls.push('low');
        return true;
      },
      { priority: -1 },
    );
    dispatchKeyDown(key('Escape'), makeDeps('chairs'));
    expect(calls).toEqual(['overlay', 'screen']);
  });

  it('unhandled Escape navigates back', () => {
    const deps = makeDeps('wait');
    const e = key('Escape');
    expect(dispatchKeyDown(e, deps)).toBe(true);
    expect(deps.back).toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  describe('Backspace fallback', () => {
    it('acts as Escape when keyboard lock is unsupported', () => {
      const seen: string[] = [];
      registerScreenKeys((k) => {
        seen.push(k);
        return k === 'Escape';
      });
      expect(dispatchKeyDown(key('Backspace'), makeDeps('chairs', false))).toBe(true);
      expect(seen).toEqual(['Backspace', 'Escape']);
    });

    it('falls back to store back() when the screen does not handle it', () => {
      const deps = makeDeps('silence', false);
      expect(dispatchKeyDown(key('Backspace'), deps)).toBe(true);
      expect(deps.back).toHaveBeenCalled();
    });

    it('is off when keyboard lock is supported', () => {
      const deps = makeDeps('silence', true);
      expect(dispatchKeyDown(key('Backspace'), deps)).toBe(false);
      expect(deps.back).not.toHaveBeenCalled();
    });

    it('is off on home (Backspace deletes a typed character)', () => {
      const seen: string[] = [];
      registerScreenKeys((k) => {
        seen.push(k);
        return false;
      });
      const deps = makeDeps('home', false);
      dispatchKeyDown(key('Backspace'), deps);
      expect(seen).toEqual(['Backspace']);
      expect(deps.back).not.toHaveBeenCalled();
    });

    it('is off inside inputs', () => {
      const input = document.createElement('input');
      document.body.append(input);
      const deps = makeDeps('prep', false);
      expect(dispatchKeyDown(key('Backspace', {}, input), deps)).toBe(false);
      expect(deps.back).not.toHaveBeenCalled();
    });
  });

  it('keyup handlers receive keys (for hold keys)', () => {
    const up = vi.fn();
    registerKeyUp(up);
    const e = new KeyboardEvent('keyup', { key: 'n' });
    dispatchKeyUp(e);
    expect(up).toHaveBeenCalledWith('n', e);
  });
});
