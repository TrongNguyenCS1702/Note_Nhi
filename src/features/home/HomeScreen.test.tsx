import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installKeyboard, resetKeyboardRegistry } from '@/app/keyboard';
import { initialAppState, useAppStore } from '@/app/store';
import { confirmAttendance, db, getOrCreateTodaySession, importRoster, setTvCheckDoneAt } from '@/db';
import { parseRosterText } from '@/domain/roster';
import { useToast } from '@/ui/toastStore';
import { HomeScreen } from './HomeScreen';
import { routeAfterCheck } from './openClassFlow';

let detach: () => void = () => {};

beforeEach(async () => {
  await db.delete();
  await db.open();
  useAppStore.setState(initialAppState);
  useToast.setState({ message: null, seq: 0 });
  resetKeyboardRegistry();
  detach = installKeyboard();
});
afterEach(() => detach());

const press = (key: string) => act(() => void fireEvent.keyDown(document.body, { key }));
const typeKeys = (s: string) => [...s].forEach((k) => press(k));

async function seed() {
  const { classIds } = await importRoster(parseRosterText('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLớp 3B\nLê Văn Cường\nLớp 5C\nPhạm Thị Dung'));
  return { a3: classIds[0]!, b3: classIds[1]!, c5: classIds[2]! };
}

describe('HomeScreen', () => {
  it('lists classes by grade with student counts and the footer links', async () => {
    await seed();
    render(<HomeScreen />);
    expect(await screen.findByText('Khối 3')).toBeTruthy();
    expect(screen.getByText('Khối 5')).toBeTruthy();
    expect(screen.queryByText('Khối 1')).toBeNull();
    expect(screen.getByRole('button', { name: /3A\s*2 bạn/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }));
    expect(useAppStore.getState().screen).toBe('settings');
  });

  it('first lesson ever: typing a class name + Enter goes to the TV check', async () => {
    const { b3 } = await seed();
    render(<HomeScreen />);
    await screen.findByText('Khối 3');
    typeKeys('x3b');
    expect(screen.getByLabelText('Tên lớp đang gõ').textContent).toBe('3B');
    press('Enter');
    await waitFor(() => expect(useAppStore.getState().screen).toBe('check'));
    expect(useAppStore.getState()).toMatchObject({ classId: b3, classLabel: 'Lớp 3B' });
    expect((await db.classes.get(b3))?.lastUsedAt).toBeTypeOf('number');
  });

  it('after the TV check: typed class goes to attendance; Backspace/Esc edit the typebox', async () => {
    const { a3 } = await seed();
    await setTvCheckDoneAt();
    render(<HomeScreen />);
    await screen.findByText('Khối 3');
    typeKeys('3z');
    press('Backspace');
    expect(screen.getByLabelText('Tên lớp đang gõ').textContent).toBe('3');
    press('Escape');
    expect(screen.getByLabelText('Tên lớp đang gõ').textContent).toBe('__');
    typeKeys('3a');
    press('Enter');
    await waitFor(() => expect(useAppStore.getState().screen).toBe('prep'));
    expect(useAppStore.getState().classId).toBe(a3);
  });

  it('unknown class → toast, stays home', async () => {
    await seed();
    await setTvCheckDoneAt();
    render(<HomeScreen />);
    await screen.findByText('Khối 3');
    typeKeys('9z');
    press('Enter');
    expect(useToast.getState().message).toBe('Không có lớp "9Z"');
    expect(useAppStore.getState().screen).toBe('home');
  });

  it('Enter with an empty typebox opens the suggested class (history of past weeks)', async () => {
    const { c5 } = await seed();
    await setTvCheckDoneAt();
    const now = Date.now();
    await getOrCreateTodaySession(c5, now - 7 * 24 * 3600 * 1000);
    await getOrCreateTodaySession(c5, now - 14 * 24 * 3600 * 1000);
    render(<HomeScreen />);
    const card = await screen.findByRole('button', { name: 'Vào lớp gợi ý 5C' });
    expect(card.textContent).toContain('theo các tuần trước');
    press('Enter');
    await waitFor(() => expect(useAppStore.getState().screen).toBe('prep'));
    expect(useAppStore.getState()).toMatchObject({ classId: c5, classLabel: 'Lớp 5C' });
  });

  it('re-opening a class already checked in today skips attendance (launcher + toast)', async () => {
    const { a3 } = await seed();
    await setTvCheckDoneAt();
    const s = await getOrCreateTodaySession(a3);
    const at = new Date();
    at.setHours(8, 5, 0, 0);
    await confirmAttendance(s.id, at.getTime());
    render(<HomeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /3A\s*2 bạn/ }));
    await waitFor(() => expect(useAppStore.getState().screen).toBe('launch'));
    expect(useToast.getState().message).toBe('Đã điểm danh lúc 08:05 · bấm D để sửa');
    // "Lớp vừa dạy" chip appears
    expect(await screen.findByText('Lớp vừa dạy')).toBeTruthy();
  });

  it('routeAfterCheck (used by the TV check screen) goes to prep when not checked in yet', async () => {
    const { a3 } = await seed();
    await routeAfterCheck(a3);
    expect(useAppStore.getState()).toMatchObject({ screen: 'prep', classId: a3, classLabel: 'Lớp 3A' });
  });
});
