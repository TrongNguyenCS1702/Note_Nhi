import type { DevicePrefsRow, UserPrefsRow } from './schemas/tables';

/** Default fun challenges (mockup CHALLENGES, SPEC 3.5). */
export const DEFAULT_FUN_CHALLENGES: readonly string[] = [
  'Cả lớp hát lại 1 câu bài vừa học',
  'Vỗ tay theo nhịp 8 lần',
  'Đứng lên ngồi xuống 5 lần',
  'Thì thầm hát 1 câu',
  'Giữ tượng 10 giây',
  'Cả lớp cùng "suỵt" thật nhỏ 3 lần',
];

export type UserPrefsValues = Pick<UserPrefsRow, 'waitMessage' | 'waitDurationSec' | 'silenceDurationSec' | 'silenceDifficulty'>;

export const DEFAULT_USER_PREFS: Readonly<UserPrefsValues> = {
  waitMessage: 'Chuẩn bị sách vở nhé!',
  waitDurationSec: 120,
  silenceDurationSec: 30,
  silenceDifficulty: 'medium',
};

export const DEFAULT_DEVICE_PREFS: Readonly<DevicePrefsRow> = {
  id: 'device',
  volume: 0.7,
  muted: false,
  tvSafeMargin: false,
  micDeviceId: null,
};

/** Waiting-screen durations offered (SPEC 3.6). */
export const WAIT_DURATIONS_SEC: readonly number[] = [10, 60, 120, 180, 300];
