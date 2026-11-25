import { audio } from '@/audio';
import { enterFullscreen } from '@/app/fullscreen';
import { useAppStore } from '@/app/store';
import { getClass, getTodaySession, getTvCheckDoneAt, logError, markClassUsed } from '@/db';
import { toast } from '@/ui/toastStore';

export interface ClassRef {
  id: string;
  name: string;
}

/** App bar pill text for a class name: "3A" → "Lớp 3A". */
export const classLabel = (name: string) => `Lớp ${name}`;

/** "08:05" (mockup uses toLocaleTimeString('vi-VN', 2-digit hour/minute)). */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Open a class from the home screen (mockup `openClass`). Call synchronously from the
 * click/key handler: fullscreen + audio unlock need the user gesture, so they run before any await.
 * Then: first lesson ever (no TV check yet) → `check`; otherwise `routeAfterCheck`.
 */
export function openClassFlow(cls: ClassRef, now = Date.now()): Promise<void> {
  void enterFullscreen();
  audio.ensure();
  return (async () => {
    await markClassUsed(cls.id, now);
    if ((await getTvCheckDoneAt()) == null) {
      useAppStore.getState().openClass(cls.id, { label: classLabel(cls.name), screen: 'check' });
      return;
    }
    await routeAfterCheck(cls.id, now, cls.name);
  })().catch((e: unknown) => {
    void logError({ screen: 'home', message: `openClassFlow: ${String(e)}` });
    toast('Ối, chưa mở được lớp này');
  });
}

/**
 * Continue into a class once the TV check is done or skipped (mockup `goClassStart`):
 * attendance already confirmed today → launcher + toast "Đã điểm danh lúc HH:MM · bấm D để sửa";
 * otherwise → attendance (prep). The check screen calls this with the store's `classId`.
 */
export async function routeAfterCheck(classId: string, now = Date.now(), className?: string): Promise<void> {
  const name = className ?? (await getClass(classId))?.name;
  const label = name ? classLabel(name) : (useAppStore.getState().classLabel ?? undefined);
  const session = await getTodaySession(classId, now);
  const at = session?.attendanceConfirmedAt;
  const { openClass } = useAppStore.getState();
  if (at != null) {
    openClass(classId, { label, screen: 'launch' });
    toast(`Đã điểm danh lúc ${formatClock(at)} · bấm D để sửa`);
  } else {
    openClass(classId, { label, screen: 'prep' });
  }
}
