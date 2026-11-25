import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore } from '@/app/store';
import {
  confirmAttendance,
  getOrCreateTodaySession,
  logError,
  renameStudent,
  toggleAbsent,
  useStudents,
  useTodaySession,
} from '@/db';
import type { SessionRow } from '@/domain';
import { Button, Eyebrow, Hint, HintBar, NameGrid, Pill, stickerColor, toast, type NameCell } from '@/ui';

/** Single click waits this long so a double click (rename) can cancel the absent toggle (mockup). */
export const CLICK_DELAY_MS = 220;

interface NameEditorProps {
  initial: string;
  style: CSSProperties;
  onDone: (value: string | null) => void;
}

/** Inline display-name editor replacing one sticker (mockup prep dblclick). */
function NameEditor({ initial, style, onDone }: NameEditorProps) {
  const done = useRef(false);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };
  return (
    <input
      className="name stk name-edit"
      style={style}
      defaultValue={initial}
      maxLength={20}
      aria-label="Sửa tên hiển thị"
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  );
}

export function PrepScreen() {
  const classId = useAppStore((s) => s.classId);
  const classLabel = useAppStore((s) => s.classLabel);
  const go = useAppStore((s) => s.go);
  const students = useStudents(classId);
  const today = useTodaySession(classId);
  const [editing, setEditing] = useState<string | null>(null);

  // Today's session: created when attendance opens (SPEC 3.2: absences apply to today only).
  const sessionP = useRef<Promise<SessionRow> | null>(null);
  const ensureSession = () => {
    if (!classId) return Promise.reject(new Error('no class'));
    sessionP.current ??= getOrCreateTodaySession(classId);
    return sessionP.current;
  };
  useEffect(() => {
    if (!classId) {
      go('home');
      return;
    }
    sessionP.current ??= getOrCreateTodaySession(classId);
    sessionP.current.catch((e: unknown) => void logError({ screen: 'prep', message: String(e) }));
  }, [classId, go]);

  const absentIds = today?.absentIds;
  const items: NameCell[] = useMemo(
    () =>
      (students ?? []).map((s, i) => {
        const absent = absentIds?.has(s.id) ?? false;
        return {
          id: s.id,
          label: s.displayName,
          title: s.fullName,
          colorIndex: i,
          className: absent ? 'absent' : undefined,
          pressed: absent,
        };
      }),
    [students, absentIds],
  );
  const total = items.length;
  const present = items.filter((c) => !c.pressed).length;

  // single click toggles absent after CLICK_DELAY_MS; a double click cancels it
  const clickTimer = useRef<{ t: ReturnType<typeof setTimeout>; id: string } | null>(null);
  const runToggle = (id: string) =>
    ensureSession()
      .then((s) => toggleAbsent(s.id, id))
      .catch((e: unknown) => void logError({ screen: 'prep', message: String(e) }));
  const cancelClick = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current.t);
    clickTimer.current = null;
  };
  /** Apply a pending single click right away (e.g. Enter pressed within 220 ms). */
  const flushClick = () => {
    const pending = clickTimer.current;
    cancelClick();
    return pending ? runToggle(pending.id) : Promise.resolve();
  };
  useEffect(() => cancelClick, []);

  const onCellClick = (id: string, e: MouseEvent<HTMLElement>) => {
    cancelClick();
    if (e.detail > 1) return;
    clickTimer.current = {
      id,
      t: setTimeout(() => {
        clickTimer.current = null;
        void runToggle(id);
      }, CLICK_DELAY_MS),
    };
  };
  const onCellDoubleClick = (id: string) => {
    cancelClick();
    setEditing(id);
  };

  const saveName = (id: string, value: string | null) => {
    setEditing(null);
    const old = students?.find((s) => s.id === id)?.displayName;
    const v = value?.trim();
    if (!v || !old || v === old) return;
    renameStudent(id, v).then(
      () => toast(`Đã đổi tên hiển thị: ${old} → ${v}`),
      (e: unknown) => void logError({ screen: 'prep', message: String(e) }),
    );
  };

  const confirming = useRef(false);
  const confirm = () => {
    if (confirming.current || !classId) return;
    confirming.current = true;
    void (async () => {
      try {
        await flushClick();
        const s = await ensureSession();
        await confirmAttendance(s.id);
        go('launch');
      } catch (e) {
        confirming.current = false;
        void logError({ screen: 'prep', message: String(e) });
      }
    })();
  };

  useScreenKeys((k) => {
    if (k === 'Enter') {
      confirm();
      return true;
    }
    if (k === 'Escape') {
      cancelClick();
      go('home');
      return true;
    }
  });

  return (
    <section className="screen" data-screen="prep">
      <div className="screen-head">
        <div>
          <Eyebrow>
            <b>{classLabel ?? ''}</b> · Điểm danh
          </Eyebrow>
          <h1>Bạn nào vắng hôm nay?</h1>
        </div>
        <div className="head-actions">
          <Pill aria-live="polite">{students ? `Có mặt ${present}/${total}` : ''}</Pill>
          <Button primary big kbd="Enter" onClick={confirm}>
            Vào tiết
          </Button>
        </div>
      </div>
      <NameGrid
        id="prep-grid"
        items={items}
        onCellClick={onCellClick}
        onCellDoubleClick={onCellDoubleClick}
        renderCell={(item, i) =>
          item.id === editing ? (
            <NameEditor
              key={item.id}
              initial={item.label}
              style={{ '--c': stickerColor(item.colorIndex ?? i) } as CSSProperties}
              onDone={(v) => saveName(item.id, v)}
            />
          ) : undefined
        }
      />
      <HintBar>
        <Hint>Nhấp: đánh dấu vắng</Hint>
        <Hint>Nhấp đúp: sửa tên hiển thị</Hint>
        <Hint k="Enter">vào tiết</Hint>
      </HintBar>
    </section>
  );
}
