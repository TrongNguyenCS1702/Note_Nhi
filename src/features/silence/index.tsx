import { useMachine } from '@xstate/react';
import { useEffect, useRef } from 'react';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore } from '@/app/store';
import { audio } from '@/audio';
import { updateUserPrefs, useDevicePrefs, useFunChallenges, useUserPrefs } from '@/db';
import { DEFAULT_FUN_CHALLENGES } from '@/domain/defaults';
import type { SilenceDifficulty, SilenceDurationSec } from '@/domain/schemas';
import { balloonScale, CALIBRATION_SEC, dbfsToMeter, HEARTS } from '@/domain/silence';
import { formatClock, silenceMachine, type SilenceContext } from '@/machines/silence';
import { Bubble, Button, cx, Eyebrow, fireConfetti, Mascot, Seg, toast, type MascotMood } from '@/ui';
import { Balloon } from './Balloon';
import { MicErrorOverlay, PopOverlay, WinOverlay } from './SilenceOverlays';

const DURATION_OPTIONS = [
  { value: 30, label: '30 giây' },
  { value: 60, label: '1 phút' },
  { value: 120, label: '2 phút' },
] as const satisfies ReadonlyArray<{ value: SilenceDurationSec; label: string }>;

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Vừa' },
  { value: 'hard', label: 'Khó' },
] as const satisfies ReadonlyArray<{ value: SilenceDifficulty; label: string }>;

const goLaunch = () => useAppStore.getState().go('launch');

type StageState = 'mic' | 'calibrating' | 'playing' | 'popped' | 'won' | 'error';

export function SilenceScreen() {
  const classLabel = useAppStore((s) => s.classLabel);
  const prefs = useUserPrefs();
  const device = useDevicePrefs();
  const challengeRows = useFunChallenges();

  const micDeviceRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    micDeviceRef.current = device?.micDeviceId ?? undefined;
  }, [device]);

  const [snap, send] = useMachine(silenceMachine, {
    input: {
      audio,
      notify: toast,
      celebrate: fireConfetti,
      savePrefs: (p) => void updateUserPrefs(p).catch(() => {}),
      exit: goLaunch,
      micDeviceId: () => micDeviceRef.current,
    },
  });

  // Preselect the remembered choice once loaded (SPEC 3.5: thường chỉ cần bấm Space).
  const configured = useRef(false);
  useEffect(() => {
    if (!prefs || configured.current) return;
    configured.current = true;
    send({ type: 'CONFIGURE', durationSec: prefs.silenceDurationSec, difficulty: prefs.silenceDifficulty });
  }, [prefs, send]);

  useEffect(() => {
    if (!challengeRows) return;
    const texts = challengeRows.map((r) => r.text).filter(Boolean);
    send({ type: 'SET_CHALLENGES', texts: texts.length ? texts : DEFAULT_FUN_CHALLENGES });
  }, [challengeRows, send]);

  const ctx = snap.context;
  const inSetup = snap.matches('setup') || snap.status === 'done';
  const stage: StageState = snap.matches({ live: 'requestingMic' })
    ? 'mic'
    : snap.matches({ live: 'calibrating' })
      ? 'calibrating'
      : snap.matches({ live: 'playing' })
        ? 'playing'
        : snap.matches('popped') || snap.matches('challenge')
          ? 'popped'
          : snap.matches('won')
            ? 'won'
            : 'error';

  const start = () => {
    audio.ensure();
    send({ type: 'START' });
  };

  useScreenKeys((k) => {
    if (k === ' ') {
      audio.ensure();
      send({ type: snap.matches('micError') ? 'RETRY' : 'START' });
      return true;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      if (stage !== 'playing') return false;
      send({ type: k === 'ArrowUp' ? 'NUDGE_UP' : 'NUDGE_DOWN' });
      return true;
    }
    if (/^[1-4]$/.test(k)) {
      audio.ensure();
      send({ type: 'OPTION', n: Number(k) });
      return true;
    }
    if (k === 'Escape') {
      if (inSetup) return false; // the app shell goes back to the launcher
      send({ type: 'EXIT' });
      return true;
    }
    return false;
  });

  return (
    <section className="screen">
      <div className="screen-head">
        <div>
          <Eyebrow>{classLabel ?? 'Lớp'} · Giữ trật tự</Eyebrow>
          <h1>Thử thách im lặng</h1>
        </div>
      </div>

      {inSetup ? (
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
              <span className="label">Độ khó</span>
              <Seg
                label="Độ khó"
                options={DIFFICULTY_OPTIONS}
                value={ctx.difficulty}
                onChange={(difficulty) => send({ type: 'SET_DIFFICULTY', difficulty })}
              />
            </div>
            <div>
              <Button primary big kbd="Space" onClick={start}>
                Bắt đầu
              </Button>
            </div>
            <p className="note">
              App dùng micro của laptop để nghe độ ồn cả lớp (không ghi âm). Trước khi chơi, app đo độ ồn nền 3 giây để tự đặt
              ngưỡng. Lần đầu, trình duyệt sẽ hỏi quyền dùng micro: thầy/cô bấm “Cho phép”.
            </p>
          </div>
          <div className="setup-side">
            <Mascot mood="shh" size="clamp(120px,12vw,180px)" />
            <Bubble>Suỵt… mình thử im lặng xem lớp nào giỏi nhất nha!</Bubble>
          </div>
        </div>
      ) : (
        <Stage ctx={ctx} stage={stage} />
      )}

      {(snap.matches({ popped: 'choose' }) || snap.matches('challenge')) && (
        <PopOverlay
          challenge={snap.matches('challenge') ? ctx.challengeText : null}
          onOption={(n) => {
            audio.ensure();
            send({ type: 'OPTION', n });
          }}
        />
      )}
      {snap.matches({ won: 'card' }) && <WinOverlay onAgain={start} onLeave={goLaunch} />}
      {snap.matches('micError') && ctx.micError && (
        <MicErrorOverlay
          kind={ctx.micError}
          onRetry={() => {
            audio.ensure();
            send({ type: 'RETRY' });
          }}
          onBack={() => send({ type: 'EXIT' })}
        />
      )}
    </section>
  );
}

function bubbleText(stage: StageState, ctx: SilenceContext): string {
  switch (stage) {
    case 'mic':
      return 'Đang mở micro…';
    case 'calibrating':
      return `Mình đang nghe thử… ${Math.max(1, Math.ceil(CALIBRATION_SEC - ctx.calibSec))}`;
    case 'playing':
      return ctx.bubble;
    case 'popped':
      return 'Bóng nổ mất rồi…';
    case 'won':
      return 'Lớp mình giỏi quá!';
    case 'error':
      return 'Ơ, mình không nghe thấy gì…';
  }
}

function mascotMood(stage: StageState, ctx: SilenceContext): MascotMood {
  if (stage === 'playing') return ctx.over ? 'noisy' : 'shh';
  if (stage === 'popped' || stage === 'error') return 'sad';
  if (stage === 'won') return 'cheer';
  return 'shh';
}

function Stage({ ctx, stage }: { ctx: SilenceContext; stage: StageState }) {
  const meterPct = (dbfsToMeter(ctx.levelDb) * 100).toFixed(1);
  const thrPct = ctx.thresholdDb == null ? null : dbfsToMeter(ctx.thresholdDb) * 100;
  return (
    <div className="sil-stage">
      <div className="sil-side">
        <div className="hearts" role="img" aria-label={`Số mạng còn lại: ${ctx.game.hearts}`}>
          {Array.from({ length: HEARTS }, (_, i) => (
            <span key={i} className={i < ctx.game.hearts ? undefined : 'lost'} aria-hidden="true">
              ♥
            </span>
          ))}
        </div>
        <div className="sil-time">{stage === 'won' ? '0:00' : formatClock(ctx.leftSec)}</div>
        <div>
          <div className={cx('meter', stage === 'playing' && ctx.over && 'over')}>
            <div className="meter-fill" style={{ width: `${meterPct}%` }} />
            {thrPct != null && <div className="meter-thr" style={{ left: `${thrPct}%` }} />}
          </div>
          <div className="meter-labels">
            <span>Yên lặng</span>
            <span>Vạch đen = ngưỡng</span>
            <span>Ồn</span>
          </div>
        </div>
        <p className="note">
          <span className="kbd">↑</span> <span className="kbd">↓</span> nới / siết ngưỡng nếu app bắt quá gắt hoặc quá lỏng
        </p>
      </div>
      <Balloon
        scale={balloonScale(ctx.leftSec, ctx.durationSec)}
        hits={ctx.hits}
        popped={stage === 'popped'}
        flying={stage === 'won'}
      />
      <div className="mascot-col">
        <Bubble aria-live="polite">{bubbleText(stage, ctx)}</Bubble>
        <Mascot mood={mascotMood(stage, ctx)} size="clamp(120px,12vw,190px)" />
      </div>
    </div>
  );
}
