import { useActorRef, useSelector } from '@xstate/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio as realAudio } from '@/audio';
import type { AudioPort } from '@/audio/types';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore } from '@/app/store';
import {
  getOrCreateTodaySession,
  getTrackBlob,
  logCall,
  setAbsent,
  setCallStatus,
  useRecentCallLogs,
  useStudents,
  useTodaySession,
  useTracks,
} from '@/db';
import { calledWithinWeek, countNotCalledThisWeek, pickStudents, type CallLogLike } from '@/domain/fairness';
import type { CallLogRow, SessionRow, StudentRow } from '@/domain/schemas';
import {
  chairsMachine,
  phaseOf,
  spinLabel,
  type ChairsPhase,
  type ChairsServices,
  type ChairsSnapshot,
} from '@/machines/chairs';
import {
  Bubble,
  Button,
  fireConfetti,
  Hint,
  HintBar,
  Mascot,
  NameGrid,
  Pill,
  toast,
  type MascotMood,
  type NameCell,
  type NameGridHandle,
} from '@/ui';
import { ChairsResult } from './ChairsResult';
import { METHOD_INFO } from './reveal';
import { useReveal } from './useReveal';

export interface ChairsScreenProps {
  /** Test seam: audio port (defaults to the real Web Audio engine). */
  audio?: AudioPort;
  /** Test seam: randomness for picks and animations. */
  rng?: () => number;
}

interface Latest {
  present: StudentRow[];
  logs: readonly CallLogLike[];
  blobs: readonly Blob[];
  byId: ReadonlyMap<string, StudentRow>;
}

const EMPTY_LOGS: CallLogRow[] = [];

function defaultBubble(s: ChairsSnapshot): string {
  const { duo, method, pickIndex, picks } = s.context;
  const info = method ? METHOD_INFO[method] : null;
  switch (phaseOf(s)) {
    case 'intro':
      return 'Lần này chơi kiểu gì đây ta?';
    case 'fast':
      return pickIndex === 0 ? (info?.fastMsg ?? '') : 'Thêm 1 bạn song ca nữa!';
    case 'slow':
    case 'between':
      return info?.slowMsg ?? '';
    case 'fakeout':
      return 'Dừng ở… ?';
    case 'revealing':
    case 'result':
      return picks.length === 2 ? 'Song ca nè!!!' : 'Là bạn này!!!';
    default:
      return duo ? 'Hôm nay có song ca nè!' : 'Đèn chạy, dừng ở ai đây ta?';
  }
}

const MASCOT_MOOD: Partial<Record<ChairsPhase, MascotMood>> = {
  fast: 'dance',
  slow: 'shh',
  fakeout: 'shh',
  between: 'shh',
  revealing: 'cheer',
  result: 'cheer',
};
const RIDER_MOOD: Partial<Record<ChairsPhase, MascotMood>> = {
  fast: 'dance',
  slow: 'idle',
  fakeout: 'idle',
  between: 'cheer',
  revealing: 'cheer',
  result: 'cheer',
};

/** Key of a phase "moment": bubble overrides from animations only live for that moment. */
const momentKey = (s: ChairsSnapshot) => `${s.context.spinId}:${s.context.pickIndex}:${phaseOf(s)}`;

/** Ghế âm nhạc (SPEC 3.4, mockup CHAIRS). */
export function ChairsScreen({ audio = realAudio, rng = Math.random }: ChairsScreenProps = {}) {
  const classId = useAppStore((s) => s.classId);
  const classLabel = useAppStore((s) => s.classLabel);
  const students = useStudents(classId);
  const today = useTodaySession(classId);
  const logs = useRecentCallLogs(classId) ?? EMPTY_LOGS;
  const tracks = useTracks('lively');

  const latest = useRef<Latest>({ present: [], logs: [], blobs: [], byId: new Map() });
  const session = useRef<Promise<SessionRow> | null>(null);
  const gridRef = useRef<NameGridHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const riderRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const clawRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bubbleOverride, setBubbleOverride] = useState<{ key: string; text: string } | null>(null);

  const [services] = useState<ChairsServices>(() => {
    const getSession = () => {
      const cid = useAppStore.getState().classId;
      if (!cid) return Promise.reject(new Error('No class selected'));
      session.current ??= getOrCreateTodaySession(cid);
      return session.current;
    };
    return {
      audio,
      rng,
      now: () => Date.now(),
      pick: (count, exclude) =>
        pickStudents({
          students: latest.current.present,
          callLogs: latest.current.logs,
          count,
          exclude,
          now: Date.now(),
          rng,
        }).map((s) => s.id),
      log: async (studentId, method) => {
        const s = await getSession();
        return logCall({ sessionId: s.id, classId: s.classId, studentId, method, game: 'chairs' });
      },
      setStatus: (id, status) => setCallStatus(id, status),
      markAbsent: async (studentId) => {
        const s = await getSession();
        await setAbsent(s.id, studentId, true);
        const st = latest.current.byId.get(studentId);
        toast(`Đã ghi ${st?.displayName ?? 'bạn này'} vắng hôm nay`);
      },
      tracks: () => latest.current.blobs,
      notify: toast,
      onError: (e) => console.error('[chairs]', e),
    };
  });

  const actor = useActorRef(chairsMachine, { input: { services } });
  const snap = useSelector(actor, (s) => s);
  const phase = phaseOf(snap);
  const { duo, picks, spinStartedAt, absentMarked, method } = snap.context;

  // Grid shows present students; ✓ and the counter are frozen during a spin so the just-logged
  // pick doesn't give the answer away (logs are written at pick time).
  const absentIds = today?.absentIds;
  const present = useMemo(
    () => (students ?? []).filter((s) => !absentIds?.has(s.id) && !absentMarked.includes(s.id)),
    [students, absentIds, absentMarked],
  );
  const spinning = phase !== 'idle';
  const shownLogs = useMemo(
    () => (spinning ? logs.filter((l) => l.at < spinStartedAt) : logs),
    [logs, spinning, spinStartedAt],
  );
  const [now] = useState(() => Date.now());
  const items = useMemo<NameCell[]>(() => {
    const order = new Map((students ?? []).map((s, i) => [s.id, i]));
    return present.map((s) => ({
      id: s.id,
      label: s.displayName,
      title: s.fullName,
      colorIndex: order.get(s.id) ?? 0,
      className: calledWithinWeek(s.id, shownLogs, now) ? 'called' : undefined,
    }));
  }, [present, students, shownLogs, now]);
  const notCalled = countNotCalledThisWeek(present, shownLogs, now);

  useEffect(() => {
    latest.current = {
      ...latest.current,
      present,
      logs,
      byId: new Map((students ?? []).map((s) => [s.id, s])),
    };
  }, [present, logs, students]);

  // lively tracks from the DB (none → synth fallback inside audio.startMusic)
  useEffect(() => {
    let alive = true;
    void Promise.all((tracks ?? []).map((t) => getTrackBlob(t.fileId)))
      .then((blobs) => {
        if (alive) latest.current = { ...latest.current, blobs: blobs.filter((b): b is Blob => !!b) };
      })
      .catch((e: unknown) => console.error('[chairs] tracks', e));
    return () => {
      alive = false;
    };
  }, [tracks]);

  // never leave music playing behind
  useEffect(() => () => audio.stopMusic(), [audio]);

  useEffect(() => {
    if (phase === 'result') fireConfetti();
  }, [phase]);

  useReveal(actor, {
    els: { wrap: wrapRef, rider: riderRef, spot: spotRef, ball: ballRef, claw: clawRef, banner: bannerRef },
    grid: gridRef,
    audio,
    rng,
    say: (text) => setBubbleOverride({ key: momentKey(actor.getSnapshot()), text }),
    onError: (e) => console.error('[chairs]', e),
  });

  const back = useAppStore((s) => s.back);
  useScreenKeys((k) => {
    const p = phaseOf(actor.getSnapshot());
    const key = k.length === 1 ? k.toLowerCase() : k;
    if (key === ' ') {
      actor.send({ type: 'SPACE' });
      return true;
    }
    if (key === 's' && p === 'idle') {
      actor.send({ type: 'TOGGLE_DUO' });
      return true;
    }
    if (key === 'r' && p === 'result') {
      actor.send({ type: 'REROLL' });
      return true;
    }
    if (key === 'v' && p === 'result') {
      actor.send({ type: 'ABSENT' });
      return true;
    }
    if (key === 'Escape') {
      if (p === 'result') actor.send({ type: 'CONTINUE' });
      else {
        actor.send({ type: 'EXIT' });
        back();
      }
      return true;
    }
    return false;
  });

  const bubble = bubbleOverride && bubbleOverride.key === momentKey(snap) ? bubbleOverride.text : defaultBubble(snap);
  const byId = new Map((students ?? []).map((s) => [s.id, s]));
  const winners = picks.map((p) => byId.get(p.studentId)).filter((s): s is StudentRow => !!s);

  return (
    <section className="screen chairs-screen" data-phase={phase} data-method={method ?? undefined}>
      <div className="screen-head">
        <div className="hero">
          <Mascot mood={MASCOT_MOOD[phase] ?? 'idle'} size="clamp(72px,12vh,140px)" />
          <Bubble aria-live="polite">{bubble}</Bubble>
        </div>
        <div className="head-actions">
          <Pill>Chưa được gọi tuần này: {notCalled}</Pill>
          <Button aria-pressed={duo} kbd="S" onClick={() => actor.send({ type: 'TOGGLE_DUO' })}>
            Song ca: {duo ? 'bật' : 'tắt'}
          </Button>
          <Button primary big kbd="Space" onClick={() => actor.send({ type: 'SPACE' })}>
            {spinLabel(phase)}
          </Button>
        </div>
      </div>
      <div className="grid-wrap" ref={wrapRef}>
        <NameGrid id="chair-grid" ref={gridRef} items={items} />
        <div className="rider" ref={riderRef} hidden>
          <Mascot mood={RIDER_MOOD[phase] ?? 'dance'} size={60} />
        </div>
        <div className="spot" ref={spotRef} hidden />
        <div className="ball" ref={ballRef} hidden>
          ♪
        </div>
        <div className="claw" ref={clawRef} hidden>
          <div className="cable" />
          <svg viewBox="0 0 70 56" aria-hidden="true">
            <path
              className="arm arm-l"
              d="M30 12 L14 32 L22 50"
              stroke="var(--ink)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="arm arm-r"
              d="M40 12 L56 32 L48 50"
              stroke="var(--ink)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="22" y="0" width="26" height="16" rx="5" fill="var(--sun)" stroke="var(--ink)" strokeWidth="4" />
          </svg>
        </div>
        <div className="method-banner" ref={bannerRef} hidden />
      </div>
      <HintBar>
        <Hint k="Space">chạy nhạc</Hint>
        <Hint k="Space">lần 2: dừng nhạc</Hint>
        <Hint k="Space">lần 3: tua nhanh</Hint>
        <Hint k="S">song ca</Hint>
        <Hint k="Esc">về</Hint>
        <span>Dấu ✓ = đã được gọi</span>
      </HintBar>
      {phase === 'result' && (
        <ChairsResult
          classLabel={classLabel}
          winners={winners}
          onContinue={() => actor.send({ type: 'CONTINUE' })}
          onReroll={() => actor.send({ type: 'REROLL' })}
          onAbsent={() => actor.send({ type: 'ABSENT' })}
        />
      )}
    </section>
  );
}
