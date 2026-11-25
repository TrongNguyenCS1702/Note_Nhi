import { useCallback, useEffect, useState } from 'react';
import { setBackupReminderAt } from '@/db';
import { loadBackupReminder, requestBackupPermission, runAutoBackupIfDue, type BackupReminder } from './autoBackup';

export interface BackupReminderState {
  /** 'needs-permission' → show "Cho phép sao lưu"; 'no-folder-reminder' → "Chọn thư mục sao lưu" (every 14 days). */
  reminder: BackupReminder;
  /** Call from the "Cho phép sao lưu" button (user gesture). Runs the backup when granted. */
  requestBackupPermission: () => Promise<boolean>;
  /** Hide the reminder for this visit. */
  dismiss: () => void;
}

/**
 * For the home screen: on mount runs the daily auto backup (SPEC 3.7, "khi về trang chủ")
 * and works out which non-blocking reminder to show.
 */
export function useBackupReminder(): BackupReminderState {
  const [reminder, setReminder] = useState<BackupReminder>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const now = Date.now();
      await runAutoBackupIfDue(now);
      const r = await loadBackupReminder(now);
      if (!alive) return;
      setReminder(r);
      // the "choose a folder" nudge counts as shown now; next one in 14 days
      if (r === 'no-folder-reminder') await setBackupReminderAt(now);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const request = useCallback(async () => {
    const ok = await requestBackupPermission();
    if (ok) {
      setReminder(null);
      await runAutoBackupIfDue(Date.now());
    }
    return ok;
  }, []);

  const dismiss = useCallback(() => setReminder(null), []);

  return { reminder, requestBackupPermission: request, dismiss };
}
