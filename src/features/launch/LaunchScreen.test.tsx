import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installKeyboard, resetKeyboardRegistry } from '@/app/keyboard';
import { initialAppState, useAppStore, type ScreenId } from '@/app/store';
import { db, getOrCreateTodaySession, importRoster, listStudents, setAbsent } from '@/db';
import { parseRosterText } from '@/domain/roster';
import { LaunchScreen } from './LaunchScreen';

let detach: () => void = () => {};

beforeEach(async () => {
  await db.delete();
  await db.open();
  resetKeyboardRegistry();
  detach = installKeyboard();
  const { classIds } = await importRoster(parseRosterText('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLê Văn Cường'));
  const classId = classIds[0]!;
  const s = await getOrCreateTodaySession(classId);
  const [an] = await listStudents(classId);
  await setAbsent(s.id, an!.id, true);
  useAppStore.setState({ ...initialAppState, screen: 'launch', classId, classLabel: 'Lớp 3A' });
});
afterEach(() => detach());

const press = (key: string) => act(() => void fireEvent.keyDown(document.body, { key }));

describe('LaunchScreen', () => {
  it('shows class + present count, 3 games and 6 coming-soon cards', async () => {
    render(<LaunchScreen />);
    expect(await screen.findByText(/Có mặt 2\/3/)).toBeTruthy();
    expect(screen.getByText('Lớp 3A')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Ghế âm nhạc',
      'Thử thách im lặng',
      'Màn hình chờ',
    ]);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
  });

  const cases: Array<[string, ScreenId]> = [
    ['1', 'chairs'],
    ['2', 'silence'],
    ['3', 'wait'],
    ['d', 'prep'],
    ['D', 'prep'],
    ['Escape', 'home'],
  ];
  it.each(cases)('key %s goes to %s', (key, to) => {
    render(<LaunchScreen />);
    press(key);
    expect(useAppStore.getState().screen).toBe(to);
  });

  it('clicking a game card opens it', () => {
    render(<LaunchScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Thử thách im lặng/ }));
    expect(useAppStore.getState().screen).toBe('silence');
  });
});
