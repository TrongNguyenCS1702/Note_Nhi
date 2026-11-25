import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installKeyboard, resetKeyboardRegistry } from '@/app/keyboard';
import { initialAppState, useAppStore } from '@/app/store';
import { absentStudentIds, db, getTodaySession, importRoster, listStudents } from '@/db';
import { parseRosterText } from '@/domain/roster';
import { useToast } from '@/ui/toastStore';
import { PrepScreen } from './PrepScreen';

let detach: () => void = () => {};
let classId = '';

beforeEach(async () => {
  await db.delete();
  await db.open();
  resetKeyboardRegistry();
  detach = installKeyboard();
  useToast.setState({ message: null, seq: 0 });
  const { classIds } = await importRoster(parseRosterText('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLê Văn Cường'));
  classId = classIds[0]!;
  useAppStore.setState({ ...initialAppState, screen: 'prep', classId, classLabel: 'Lớp 3A' });
});
afterEach(() => detach());

const press = (key: string) => act(() => void fireEvent.keyDown(document.body, { key }));

describe('PrepScreen', () => {
  it('click toggles absent (after the dblclick delay), pill counts, Enter confirms → launcher', async () => {
    const user = userEvent.setup();
    render(<PrepScreen />);
    const binh = await screen.findByRole('button', { name: 'Bình' });
    expect(screen.getByText('Có mặt 3/3')).toBeTruthy();
    await user.click(binh);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bình' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByRole('button', { name: 'Bình' }).className).toContain('absent');
    expect(screen.getByText('Có mặt 2/3')).toBeTruthy();

    press('Enter');
    await waitFor(() => expect(useAppStore.getState().screen).toBe('launch'));
    const s = await getTodaySession(classId);
    expect(s?.attendanceConfirmedAt).toBeTypeOf('number');
    const [, b] = await listStudents(classId);
    expect([...(await absentStudentIds(s!.id))]).toEqual([b!.id]);
  });

  it('double click renames inline (Enter saves) without toggling absent', async () => {
    const user = userEvent.setup();
    render(<PrepScreen />);
    await user.dblClick(await screen.findByRole('button', { name: 'An' }));
    const input = screen.getByRole('textbox', { name: 'Sửa tên hiển thị' });
    await user.clear(input);
    await user.type(input, 'Văn An{Enter}');
    expect(await screen.findByRole('button', { name: 'Văn An' })).toBeTruthy();
    expect(useToast.getState().message).toBe('Đã đổi tên hiển thị: An → Văn An');
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByRole('button', { name: 'Văn An' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Esc in the editor cancels; Esc on the screen goes home', async () => {
    const user = userEvent.setup();
    render(<PrepScreen />);
    await user.dblClick(await screen.findByRole('button', { name: 'Cường' }));
    await user.type(screen.getByRole('textbox'), 'xyz{Escape}');
    expect(await screen.findByRole('button', { name: 'Cường' })).toBeTruthy();
    expect(useAppStore.getState().screen).toBe('prep');
    press('Escape');
    expect(useAppStore.getState().screen).toBe('home');
  });
});
