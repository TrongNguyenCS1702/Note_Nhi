import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getUserPrefs, updateUserPrefs } from '@/db';

const fake = vi.hoisted(() => ({ audio: null as unknown as import('@/audio/fake').FakeAudio }));
vi.mock('@/audio', async () => {
  const { createFakeAudio } = await import('@/audio/fake');
  fake.audio = createFakeAudio({ mic: { intervalMs: 1_000_000 } });
  return { audio: fake.audio };
});

const { SilenceScreen } = await import('./index');

beforeEach(async () => {
  await db.delete();
  await db.open();
  fake.audio.reset();
  fake.audio.setMicOptions({ intervalMs: 1_000_000 });
});

describe('SilenceScreen', () => {
  it('preselects remembered settings, saves on start and shows the stage', async () => {
    await updateUserPrefs({ silenceDurationSec: 60, silenceDifficulty: 'hard' });
    render(<SilenceScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: '1 phút' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByRole('button', { name: 'Khó' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '2 phút' }));
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu/ }));
    await waitFor(() => expect(screen.getByText(/Mình đang nghe thử/)).toBeTruthy());
    expect(screen.getByText('2:00')).toBeTruthy();
    await waitFor(async () => expect((await getUserPrefs()).silenceDurationSec).toBe(120));
    expect(fake.audio.mic?.closed).toBe(false);
  });

  it('shows how to allow the mic when it is denied', async () => {
    fake.audio.setMicOptions({ error: 'denied' });
    render(<SilenceScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu/ }));
    await waitFor(() => expect(screen.getByText('Chưa được dùng micro')).toBeTruthy());
    expect(screen.getByText(/Cho phép/, { selector: 'li' })).toBeTruthy();
    fake.audio.setMicOptions({ intervalMs: 1_000_000 });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    });
    await waitFor(() => expect(screen.queryByText('Chưa được dùng micro')).toBeNull());
  });

  it('closes the mic on unmount', async () => {
    const view = render(<SilenceScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu/ }));
    await waitFor(() => expect(fake.audio.mic).toBeTruthy());
    view.unmount();
    expect(fake.audio.mic?.closed).toBe(true);
  });
});
