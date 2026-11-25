import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialAppState, onMuteChange, useAppStore } from './store';

beforeEach(() => useAppStore.setState(initialAppState));

describe('app store navigation', () => {
  it('starts on home without a class', () => {
    const s = useAppStore.getState();
    expect(s.screen).toBe('home');
    expect(s.classId).toBeNull();
  });

  it('go() switches screen', () => {
    useAppStore.getState().go('settings');
    expect(useAppStore.getState().screen).toBe('settings');
  });

  it('openClass() selects the class, sets the pill label and lands on prep by default', () => {
    useAppStore.getState().openClass('3A');
    expect(useAppStore.getState()).toMatchObject({ classId: '3A', classLabel: 'Lớp 3A', screen: 'prep' });
    useAppStore.getState().openClass('4B', { screen: 'launch', label: 'Lớp 4B · 38 bạn' });
    expect(useAppStore.getState()).toMatchObject({ classId: '4B', classLabel: 'Lớp 4B · 38 bạn', screen: 'launch' });
  });

  it('back() walks game → launcher → home and stops there', () => {
    const { go, back } = useAppStore.getState();
    go('chairs');
    expect(back()).toBe(true);
    expect(useAppStore.getState().screen).toBe('launch');
    expect(back()).toBe(true);
    expect(useAppStore.getState().screen).toBe('home');
    expect(back()).toBe(false);
    expect(useAppStore.getState().screen).toBe('home');
  });

  it('notifies mute subscribers only on change', () => {
    const cb = vi.fn();
    const off = onMuteChange(cb);
    useAppStore.getState().toggleMute();
    useAppStore.getState().setMuted(true);
    useAppStore.getState().go('launch');
    useAppStore.getState().setMuted(false);
    off();
    useAppStore.getState().toggleMute();
    expect(cb.mock.calls).toEqual([[true], [false]]);
  });
});
