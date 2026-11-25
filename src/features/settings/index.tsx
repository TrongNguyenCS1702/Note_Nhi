import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/app/store';
import { audio, dbfsToPercent, MicError, type MicHandle } from '@/audio';
import {
  addFunChallenge,
  addScheduleSlot,
  backupFileName,
  clearTvCheckDone,
  deleteFunChallenge,
  deleteScheduleSlot,
  exportZipBlob,
  getBackupDirHandle,
  getLastBackupAt,
  importPackage,
  readPackage,
  updateDevicePrefs,
  updateFunChallenge,
  updateScheduleSlot,
  useClassesByGrade,
  useDevicePrefs,
  useFunChallenges,
  useScheduleSlots,
  wipeAll,
} from '@/db';
import type { FunChallengeRow } from '@/domain/schemas';
import { backupNow, chooseBackupFolder, isFolderBackupSupported } from '@/features/backup';
import { FileDrop } from '@/features/welcome/FileDrop';
import { Button, Eyebrow, toast } from '@/ui';
import '@/features/classes/admin.css';

export const WIPE_WORD = 'XOA';
export const canWipe = (input: string): boolean => input.trim() === WIPE_WORD;

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const timeToMin = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
};

const MIC_MESSAGES: Record<MicError['kind'], string> = {
  denied: 'Chưa cho phép dùng micro. Bấm biểu tượng ổ khoá cạnh địa chỉ trang để cho phép',
  'no-device': 'Không tìm thấy micro. Hãy cắm micro rồi thử lại',
  ended: 'Micro vừa bị ngắt kết nối. Hãy cắm lại và thử lại',
  unsupported: 'Trình duyệt này không hỗ trợ micro. Hãy dùng Chrome hoặc Edge',
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const bare = { border: 0, padding: 0 } as const;

/** Cài đặt: one scrollable page of sections. */
export function SettingsScreen() {
  const go = useAppStore((s) => s.go);
  return (
    <section className="screen">
      <div className="screen-head">
        <div>
          <Eyebrow>Cài đặt</Eyebrow>
          <h1>Cài đặt</h1>
        </div>
        <div className="head-actions">
          <Button kbd="Esc" onClick={() => go('home')}>
            Về trang chủ
          </Button>
        </div>
      </div>
      <div className="admin-grid">
        <VolumeSection />
        <MicSection />
        <TvSection />
        <ChallengeSection />
        <ScheduleSection />
        <BackupSection />
        <WipeSection />
      </div>
    </section>
  );
}

function VolumeSection() {
  const prefs = useDevicePrefs();
  const [v, setV] = useState<number | null>(null);
  const value = v ?? prefs?.volume ?? 0.8;
  return (
    <div className="panel">
      <h2 className="admin-section-title">Âm lượng</h2>
      <label className="field">
        <span className="label">Âm lượng chung: {Math.round(value * 100)}%</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={value}
          onChange={(e) => {
            const applied = audio.setVolume(Number(e.target.value));
            setV(applied);
            void updateDevicePrefs({ volume: applied });
          }}
        />
      </label>
      <Button
        onClick={() => {
          audio.ensure();
          audio.sfx('tada');
        }}
      >
        Test loa
      </Button>
    </div>
  );
}

function MicSection() {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const live = useRef<MicHandle | null>(null);
  const offs = useRef<(() => void)[]>([]);

  const close = () => {
    offs.current.forEach((f) => f());
    offs.current = [];
    live.current?.close();
    live.current = null;
    setOpen(false);
    setPct(0);
  };
  useEffect(() => close, []);

  const start = async () => {
    setError(null);
    try {
      const h = await audio.openMic();
      live.current = h;
      setOpen(true);
      offs.current = [
        h.onLevel((db) => setPct(dbfsToPercent(db))),
        h.onError((e) => {
          setError(MIC_MESSAGES[e.kind]);
          close();
        }),
      ];
    } catch (e) {
      setError(e instanceof MicError ? MIC_MESSAGES[e.kind] : 'Không mở được micro');
    }
  };

  return (
    <div className="panel">
      <h2 className="admin-section-title">Test mic</h2>
      <div className="admin-row" style={bare}>
        {open ? <Button onClick={close}>Tắt mic</Button> : <Button onClick={() => void start()}>Bật mic để thử</Button>}
        {open && (
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Mức âm thanh"
            style={{
              flex: 1,
              minWidth: 160,
              height: 22,
              border: 'var(--bw) solid var(--ink)',
              borderRadius: 12,
              background: 'var(--paper)',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--sun)' }} />
          </div>
        )}
      </div>
      {error && <p className="admin-warn">{error}</p>}
      <p className="note">Nói hoặc vỗ tay, thanh phải nhích lên. Micro chỉ đo to nhỏ, không ghi âm.</p>
    </div>
  );
}

function TvSection() {
  const prefs = useDevicePrefs();
  const on = prefs?.tvSafeMargin ?? false;
  return (
    <div className="panel">
      <h2 className="admin-section-title">Màn hình TV</h2>
      <div className="admin-chips">
        <Button
          aria-pressed={on}
          onClick={() => {
            useAppStore.getState().setSafeMargin(!on);
            void updateDevicePrefs({ tvSafeMargin: !on });
          }}
        >
          Lề an toàn TV: {on ? 'Bật' : 'Tắt'}
        </Button>
        <Button
          onClick={async () => {
            await clearTvCheckDone();
            toast('Lần mở app sau sẽ chạy lại kiểm tra TV');
          }}
        >
          Chạy lại kiểm tra trên TV
        </Button>
      </div>
      <p className="note">Bật lề an toàn nếu TV cắt mất mép màn hình.</p>
    </div>
  );
}

function ChallengeSection() {
  const rows = useFunChallenges();
  const [text, setText] = useState('');
  const add = async () => {
    if (!text.trim()) return;
    await addFunChallenge(text);
    setText('');
  };
  return (
    <div className="panel">
      <h2 className="admin-section-title">Thử thách vui</h2>
      <ul className="admin-list">
        {rows?.map((r) => (
          <li key={r.id} className="admin-row">
            <ChallengeText row={r} />
            <Button aria-label={`Xoá thử thách ${r.text}`} onClick={() => void deleteFunChallenge(r.id)}>
              ✕
            </Button>
          </li>
        ))}
      </ul>
      <div className="admin-row" style={bare}>
        <input
          className="text-input grow"
          aria-label="Thử thách mới"
          placeholder="Vd: Hát một câu"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <Button primary disabled={!text.trim()} onClick={() => void add()}>
          Thêm
        </Button>
      </div>
    </div>
  );
}

function ChallengeText({ row }: { row: FunChallengeRow }) {
  const [v, setV] = useState(row.text);
  const save = () => {
    if (!v.trim()) return setV(row.text);
    if (v !== row.text) void updateFunChallenge(row.id, v);
  };
  return (
    <input
      className="text-input grow"
      aria-label={`Thử thách ${row.text}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && save()}
    />
  );
}

function WeekdaySelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <select className="text-input" aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {WEEKDAYS.map((w, i) => (
        <option key={w} value={i + 1}>
          {w}
        </option>
      ))}
    </select>
  );
}

function ScheduleSection() {
  const slots = useScheduleSlots();
  const groups = useClassesByGrade();
  const classes = groups?.flatMap((g) => g.classes) ?? [];
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState('07:30');
  const [classId, setClassId] = useState('');
  const chosen = classId || classes[0]?.id || '';
  const startMin = timeToMin(time);
  const nameOf = (id: string) => classes.find((c) => c.id === id)?.name ?? '(lớp đã xoá)';

  return (
    <div className="panel">
      <h2 className="admin-section-title">Thời khoá biểu</h2>
      <p className="note">Để app tự gợi ý lớp đang học ở trang chủ.</p>
      <ul className="admin-list">
        {slots?.map((s) => (
          <li key={s.id} className="admin-row">
            <WeekdaySelect
              label="Thứ"
              value={s.weekday}
              onChange={(weekday) => void updateScheduleSlot(s.id, { weekday })}
            />
            <strong>{minToTime(s.startMin)}</strong>
            <span className="grow">Lớp {nameOf(s.classId)}</span>
            <Button
              aria-label={`Xoá tiết ${WEEKDAYS[s.weekday - 1]} ${minToTime(s.startMin)}`}
              onClick={() => void deleteScheduleSlot(s.id)}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>
      {classes.length === 0 ? (
        <p className="note">Hãy thêm lớp trước khi xếp thời khoá biểu.</p>
      ) : (
        <div className="admin-row" style={bare}>
          <WeekdaySelect label="Thứ mới" value={weekday} onChange={setWeekday} />
          <input
            className="text-input"
            type="time"
            aria-label="Giờ bắt đầu"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <select className="text-input" aria-label="Lớp" value={chosen} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            primary
            disabled={startMin === null || !chosen}
            onClick={() => startMin !== null && void addScheduleSlot({ weekday, startMin, classId: chosen })}
          >
            Thêm tiết
          </Button>
        </div>
      )}
    </div>
  );
}

function BackupSection() {
  const [folder, setFolder] = useState<string | null>(null);
  const [last, setLast] = useState<number | undefined>();
  const [withMusic, setWithMusic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);

  useEffect(() => {
    void (async () => {
      const h = (await getBackupDirHandle()) as { name?: string } | undefined;
      setFolder(h?.name ?? null);
      setLast(await getLastBackupAt());
    })();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  };

  const doImport = (file: File) =>
    run(async () => {
      const s = await importPackage(file);
      toast(
        `Đã nhập ${s.classes} lớp, ${s.students} học sinh, ${s.tracks} bài nhạc${s.missingMusic ? ` (thiếu file nhạc ${s.missingMusic} bài)` : ''}`,
      );
    });

  // Backups replace everything, so confirm first; setup packages merge safely.
  const onFile = async (f: File) => {
    try {
      const { data } = await readPackage(f);
      if (data.format === 'note-nhi-backup') setPending(f);
      else await doImport(f);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'File này không đọc được');
    }
  };

  return (
    <div className="panel">
      <h2 className="admin-section-title">Sao lưu</h2>
      {isFolderBackupSupported() ? (
        <div className="admin-row" style={bare}>
          <span className="grow">
            {folder ? `Thư mục: ${folder}` : 'Chưa chọn thư mục sao lưu'}
            {last && <small> · lần cuối {new Date(last).toLocaleString('vi-VN')}</small>}
          </span>
          <Button onClick={async () => setFolder((await chooseBackupFolder()) ?? folder)}>Chọn thư mục</Button>
          <Button
            primary
            disabled={busy || !folder}
            onClick={() =>
              void run(async () => {
                const r = await backupNow();
                if (r === 'written') {
                  setLast(Date.now());
                  toast('Đã sao lưu xong');
                } else toast(r === 'no-folder' ? 'Hãy chọn thư mục trước' : 'Chưa được phép ghi vào thư mục');
              })
            }
          >
            Sao lưu ngay
          </Button>
        </div>
      ) : (
        <p className="note">Trình duyệt này không tự sao lưu vào thư mục được. Hãy dùng nút xuất file bên dưới.</p>
      )}
      <label className="admin-row" style={bare}>
        <input type="checkbox" checked={withMusic} onChange={(e) => setWithMusic(e.target.checked)} />
        <span>Kèm nhạc (file to hơn)</span>
      </label>
      <div className="admin-chips">
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () =>
              download(
                await exportZipBlob({ format: 'note-nhi-backup', includeMusic: withMusic }),
                backupFileName('note-nhi-backup', Date.now(), { dated: true }),
              ),
            )
          }
        >
          Xuất file sao lưu (.zip)
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => download(await exportZipBlob({ format: 'note-nhi-setup' }), backupFileName('note-nhi-setup')))
          }
        >
          Xuất gói cài đặt
        </Button>
      </div>
      <FileDrop
        accept=".zip"
        onFiles={(f) => void onFile(f[0]!)}
        disabled={busy}
        className="admin-drop"
        aria-label="Nhập file .zip"
      >
        <strong>Nhập file .zip</strong>
        <span>Thả file sao lưu hoặc gói cài đặt vào đây</span>
      </FileDrop>
      {pending && (
        <div className="admin-warn" role="alertdialog" aria-label="Xác nhận khôi phục">
          <p>
            Khôi phục từ file sao lưu sẽ XOÁ toàn bộ dữ liệu hiện tại trên máy này và thay bằng dữ liệu trong file. Tiếp
            tục?
          </p>
          <div className="admin-chips">
            <Button
              primary
              onClick={() => {
                const f = pending;
                setPending(null);
                void doImport(f);
              }}
            >
              Khôi phục
            </Button>
            <Button onClick={() => setPending(null)}>Huỷ</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function WipeSection() {
  const go = useAppStore((s) => s.go);
  const [word, setWord] = useState('');
  return (
    <div className="panel">
      <h2 className="admin-section-title">Xoá toàn bộ dữ liệu</h2>
      <p className="note">
        Xoá hết lớp, học sinh, nhạc và lịch sử trên máy này. Không thể hoàn tác. Hãy sao lưu trước.
      </p>
      <div className="admin-row" style={bare}>
        <input
          className="text-input grow"
          aria-label={`Gõ ${WIPE_WORD} để xác nhận`}
          placeholder={`Gõ ${WIPE_WORD} để xác nhận`}
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <Button
          disabled={!canWipe(word)}
          onClick={async () => {
            await wipeAll();
            go('welcome');
          }}
        >
          Xoá hết
        </Button>
      </div>
    </div>
  );
}
