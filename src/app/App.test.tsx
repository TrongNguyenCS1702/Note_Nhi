import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { initialAppState, useAppStore } from './store';

const sw = vi.hoisted(() => ({ needRefresh: false, update: vi.fn(async () => {}) }));
// `virtual:pwa-register/react` only exists under the Vite PWA plugin, so swap the SW-bound wrapper.
vi.mock('./UpdatePrompt', async () => {
  const { UpdatePill } = await import('./UpdatePill');
  return {
    UpdatePrompt: ({ visible }: { visible: boolean }) => (
      <UpdatePill visible={visible} needRefresh={sw.needRefresh} onUpdate={() => void sw.update()} />
    ),
  };
});

beforeEach(() => {
  useAppStore.setState(initialAppState);
  sw.needRefresh = false;
});
afterEach(cleanup);

const press = (key: string) => fireEvent.keyDown(document.body, { key });

describe('App', () => {
  it('renders the app name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Lớp Nhạc Vui' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /vào lớp nào nhỉ/ })).toBeTruthy();
  });

  it('Esc goes back from a game to the launcher; class pill hidden on home', () => {
    render(<App />);
    expect(screen.queryByText('Lớp 3A')).toBeNull();
    act(() => useAppStore.getState().openClass('3A', { label: 'Lớp 3A', screen: 'launch' }));
    expect(screen.getAllByText('Lớp 3A').length).toBeGreaterThan(0);
    act(() => void press('2'));
    expect(useAppStore.getState().screen).toBe('silence');
    act(() => void press('Escape'));
    expect(useAppStore.getState().screen).toBe('launch');
  });

  it('M toggles mute outside home and updates the app bar', () => {
    useAppStore.setState({ screen: 'launch', classId: '3A', classLabel: 'Lớp 3A' });
    render(<App />);
    act(() => void press('m'));
    expect(useAppStore.getState().muted).toBe(true);
    expect(screen.getByRole('button', { name: /Tiếng: tắt/ })).toBeTruthy();
  });

  it('shows the update pill only on home', () => {
    sw.needRefresh = true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Có bản mới · Cập nhật' }));
    expect(sw.update).toHaveBeenCalled();
    act(() => useAppStore.getState().go('settings'));
    expect(screen.queryByRole('button', { name: 'Có bản mới · Cập nhật' })).toBeNull();
  });
});
