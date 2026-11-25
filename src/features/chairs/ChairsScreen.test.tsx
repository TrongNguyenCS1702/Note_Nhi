import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeAudio } from '@/audio/fake';
import { installKeyboard, resetKeyboardRegistry } from '@/app/keyboard';
import { initialAppState, useAppStore } from '@/app/store';
import { callLogsForClass, db, importRoster } from '@/db';
import { parseRosterText } from '@/domain/roster';
import { INTRO_MS, REVEAL_MS } from '@/machines/chairs';
import { ChairsScreen } from './ChairsScreen';

let detach: () => void = () => {};

beforeEach(async () => {
  await db.delete();
  await db.open();
  resetKeyboardRegistry();
  detach = installKeyboard();
});
afterEach(() => detach());

const press = (key: string) => act(() => void fireEvent.keyDown(document.body, { key }));
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

async function setup() {
  const { classIds } = await importRoster(parseRosterText('Lớp 3A\nNguyễn Văn An\nTrần Thị Bình\nLê Minh Châu'));
  const classId = classIds[0]!;
  useAppStore.setState({ ...initialAppState, screen: 'chairs', classId, classLabel: 'Lớp 3A' });
  const audio = createFakeAudio();
  render(<ChairsScreen audio={audio} />);
  await screen.findByText('An');
  return { classId, audio };
}

describe('ChairsScreen', () => {
  it('shows the present students, counter and idle controls', async () => {
    await setup();
    expect(document.querySelectorAll('#chair-grid .name')).toHaveLength(3);
    expect(screen.getByText('Chưa được gọi tuần này: 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Quay/ })).toBeTruthy();
    expect(screen.getByText('Đèn chạy, dừng ở ai đây ta?')).toBeTruthy();
    press('s');
    expect(screen.getByRole('button', { name: /Song ca: bật/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Hôm nay có song ca nè!')).toBeTruthy();
  });

  it('spins: logs the pick at once, reveals the result, R marks it skipped', async () => {
    const { classId, audio } = await setup();
    press(' ');
    expect(screen.getByText('Lần này chơi kiểu gì đây ta?')).toBeTruthy();
    await waitFor(async () => expect(await callLogsForClass(classId)).toHaveLength(1));
    // the ✓ of the just-logged pick must not appear during the spin
    expect(document.querySelectorAll('#chair-grid .name.called')).toHaveLength(0);

    await wait(INTRO_MS + 50);
    expect(screen.getByRole('button', { name: /Dừng nhạc/ })).toBeTruthy();
    expect(audio.callsOf('startMusic')).toHaveLength(1);
    press(' ');
    expect(screen.getByRole('button', { name: /Tua nhanh/ })).toBeTruthy();
    expect(audio.music).toBeNull();
    press(' ');
    await wait(REVEAL_MS + 50);

    const dialog = await screen.findByRole('dialog');
    const [log] = await callLogsForClass(classId);
    const student = await db.students.get(log!.studentId);
    expect(dialog.textContent).toContain(student!.fullName);
    expect(screen.getByRole('button', { name: /Bạn này vắng/ })).toBeTruthy();
    expect(audio.callsOf('sfx')).toContainEqual(['tada']);

    press('r');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(async () => {
      const logs = await callLogsForClass(classId);
      expect(logs.map((l) => l.status).sort()).toEqual(['called', 'skipped']);
    });
  }, 20000);

  it('Esc leaves to the launcher and stops the music', async () => {
    const { audio } = await setup();
    press('Escape');
    expect(useAppStore.getState().screen).toBe('launch');
    expect(audio.callsOf('stopMusic').length).toBeGreaterThan(0);
  });
});
