import { useMachine } from '@xstate/react';
import { useEffect, useRef } from 'react';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore } from '@/app/store';
import { audio } from '@/audio';
import { getTrackBlob, updateUserPrefs, useTracks, useUserPrefs } from '@/db';
import { formatClock } from '@/machines/silence';
import { bannerText, WAIT_ADJUST_SEC, WAIT_DONE_MESSAGE, WAIT_FINAL_SEC, WAIT_MESSAGE_MAX, waitMachine } from '@/machines/wait';
import { Button, cx, Eyebrow, Hint, HintBar, Mascot, Seg, type MascotMood } from '@/ui';

const DURATION_OPTIONS = [
  { value: 10, label: '10 giây (thử)' },
  { value: 60, label: '1 phút' },
  { value: 120, label: '2 phút' },
  { value: 180, label: '3 phút' },
  { value: 300, label: '5 phút' },
] as const;

const RING_R = 104;
const RING_C = 2 * Math.PI * RING_R;

export function WaitScreen() {
  const classLabel = useAppStore((s) => s.classLabel);
  const prefs = useUserPrefs();
  const calmRows = useTracks('calm');

  // Calm blobs are preloaded so music can start synchronously inside the Space keypress.
  const blobsRef = useRef<Blob[]>([]);
  useEffect(() => {
    if (!calmRows) return;
    let cancelled = false;
    void Promise.all(calmRows.map((r) => getTrackBlob(r.fileId).catch(() => undefined))).then((blobs) => {
      if (!cancelled) blobsRef.current = blobs.filter((b): b is Blob => !!b);
    });
    return () => {
      cancelled = true;
    };
  }, [calmRows]);

  const [snap, send] = useMachine(waitMachine, {
    input: {
      audio,
      calmTracks: () => blobsRef.current,
      savePrefs: (p) => void updateUserPrefs(p).catch(() => {}),
      exit: () => useAppStore.getState().go('launch'),
    },
  });

  const configured = useRef(false);
  useEffect(() => {
    if (!prefs || configured.current) return;
    configured.current = true;
    send({ type: 'CONFIGURE', durationSec: prefs.waitDurationSec, message: prefs.waitMessage });
  }, [prefs, send]);

  const ctx = snap.context;
  const inSetup = snap.matches('setup') || snap.status === 'done';
  const finished = snap.matches('done');
  const paused = snap.matches({ active: 'paused' });
  const final = !inSetup && !finished && ctx.leftSec <= WAIT_FINAL_SEC && ctx.leftSec > 0;

  useScreenKeys((k, e) => {
    // Typing in the message box must not trigger shortcuts.
    if (e.target instanceof HTMLInputElement && k !== 'Escape') return false;
    if (k === ' ') {
      audio.ensure();
      send({ type: 'TOGGLE' });
      return true;
    }
    if (k === '+' || k === '=' || k === '-' || k === '_') {
      if (inSetup) return false;
      send({ type: 'ADJUST', deltaSec: k === '+' || k === '=' ? WAIT_ADJUST_SEC : -WAIT_ADJUST_SEC });
      return true;
    }
    if (k === 'Escape') {
      if (inSetup) return false; // the app shell goes back to the launcher
      send({ type: 'EXIT' });
      return true;
    }
    return false;
  });

  const mood: MascotMood = finished ? 'cheer' : final ? 'dance' : 'calm';
  const ratio = ctx.totalSec > 0 ? Math.min(1, ctx.leftSec / ctx.totalSec) : 0;

  return (
    <section className="screen">
      {inSetup ? (
        <>
          <div className="screen-head">
            <div>
              <Eyebrow>{classLabel ?? 'Lớp'} · Chuyển hoạt động</Eyebrow>
              <h1>Màn hình chờ</h1>
            </div>
          </div>
          <div className="setup-wrap">
            <div className="panel">
              <div className="field">
                <span className="label">Thời gian</span>
                <Seg
                  label="Thời gian"
                  options={DURATION_OPTIONS}
                  value={ctx.durationSec}
                  onChange={(durationSec) => send({ type: 'SET_DURATION', durationSec })}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="wait-text">
                  Lời nhắn
                </label>
                <input
                  id="wait-text"
                  className="text-input"
                  maxLength={WAIT_MESSAGE_MAX}
                  value={ctx.message}
                  onChange={(e) => send({ type: 'SET_MESSAGE', message: e.target.value })}
                />
              </div>
              <div>
                <Button
                  primary
                  big
                  kbd="Space"
                  onClick={() => {
                    audio.ensure();
                    send({ type: 'TOGGLE' });
                  }}
                >
                  Bắt đầu
                </Button>
              </div>
              <p className="note">Nhạc nền lấy từ nhóm bài chậm mà thầy/cô đã nạp; chưa có bài nào thì app dùng nhạc tự tạo.</p>
            </div>
            <div className="setup-side">
              <Mascot mood="calm" size="clamp(120px,12vw,180px)" />
            </div>
          </div>
        </>
      ) : (
        <div className={cx('wait-run', final && 'final', paused && 'paused')}>
          <p className="banner" aria-live="polite">
            {finished ? WAIT_DONE_MESSAGE : bannerText(ctx.message)}
          </p>
          <div className="wait-body">
            <Mascot mood={mood} size="clamp(110px,13vw,200px)" />
            <div className="ring">
              <svg viewBox="0 0 260 260" aria-hidden="true">
                <circle cx="130" cy="130" r="118" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5" />
                <circle
                  cx="130"
                  cy="130"
                  r={RING_R}
                  stroke={ctx.leftSec <= WAIT_FINAL_SEC ? 'var(--coral)' : 'var(--mint)'}
                  strokeWidth="22"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={(RING_C * (1 - ratio)).toFixed(1)}
                />
              </svg>
              <div className="t">{final ? Math.ceil(ctx.leftSec) : formatClock(ctx.leftSec)}</div>
            </div>
          </div>
          <HintBar>
            <Hint k="Space">{paused ? 'tiếp tục' : 'tạm dừng'}</Hint>
            <Hint k={['+', '-']}>thêm / bớt 30 giây</Hint>
            <Hint k="Esc">về</Hint>
          </HintBar>
        </div>
      )}
    </section>
  );
}
