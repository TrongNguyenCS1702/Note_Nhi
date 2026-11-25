// "Thử thách im lặng" game flow (SPEC 3.5, mockup silStart/silTick/silPop/silWin/popOption).
// Time and the microphone are injected: `deps.now` measures dt between mic levels and
// `deps.audio.openMic` provides the levels, so tests run with fake timers + the fake mic.
import { assign, fromCallback, setup } from 'xstate';
import { MicError, type AudioPort, type MicErrorKind, type MicHandle } from '@/audio/types';
import { DEFAULT_FUN_CHALLENGES, DEFAULT_USER_PREFS } from '@/domain/defaults';
import type { SilenceDifficulty, SilenceDurationSec } from '@/domain/schemas';
import {
  CALIBRATION_SEC,
  computeThreshold,
  harderSilence,
  initialSilenceState,
  isNoisyBaseline,
  median,
  nudgeThreshold,
  silenceStep,
  type SilenceState,
} from '@/domain/silence';

/** Longest frame we accept (a stalled tab must not cost a heart in one jump). */
export const MAX_LEVEL_DT = 0.25;
/** Delay between the balloon burst and the 4 options (mockup: 900 ms). */
export const POP_OPTIONS_DELAY_MS = 900;
/** Delay between the balloon flying away and the win card (mockup: 700 ms). */
export const WIN_CARD_DELAY_MS = 700;
/** Fun-challenge spinner: 14 ticks slowing down (60 + n·12 ms), then ta-da. */
export const CHALLENGE_ROLLS = 14;
export const challengeRollDelayMs = (n: number): number => 60 + n * 12;

export const DIFFICULTY_LABEL: Record<SilenceDifficulty, string> = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };

/** m:ss, rounded up (mockup `fmt`). */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const SILENCE_TEXT = {
  start: 'Bắt đầu! Suỵt…',
  quiet: 'Suỵt… giỏi lắm!',
  noisy: 'Ồn quá à!',
  hearts: (n: number) => `Còn ${n} mạng thôi!`,
  noisyBaseline: 'Lúc đo lớp còn hơi ồn, ngưỡng đã được giới hạn. Chỉnh bằng ↑ ↓',
  nudgeUp: 'Nới ngưỡng: chịu ồn hơn một chút',
  nudgeDown: 'Siết ngưỡng: bắt gắt hơn một chút',
  nudgeLimit: 'Ngưỡng đã ở mức giới hạn',
  harder: (durationSec: number, difficulty: SilenceDifficulty) =>
    `Khó hơn: ${formatClock(durationSec)} · độ khó ${DIFFICULTY_LABEL[difficulty]}`,
} as const;

export interface SilenceDeps {
  audio: AudioPort;
  /** Milliseconds clock (default `performance.now`). */
  now?: () => number;
  rng?: () => number;
  /** Toast. */
  notify?: (message: string) => void;
  /** Confetti on win. */
  celebrate?: () => void;
  /** Remember the last duration/difficulty (UserPrefs). */
  savePrefs?: (prefs: { silenceDurationSec: SilenceDurationSec; silenceDifficulty: SilenceDifficulty }) => void;
  /** Leave the game (option 4 / Esc on setup when the machine handles it). */
  exit?: () => void;
  /** Mic chosen in settings. */
  micDeviceId?: () => string | undefined;
}

export interface SilenceInput extends SilenceDeps {
  durationSec?: SilenceDurationSec;
  difficulty?: SilenceDifficulty;
  challenges?: readonly string[];
}

interface ResolvedDeps {
  audio: AudioPort;
  now: () => number;
  rng: () => number;
  notify: (message: string) => void;
  celebrate: () => void;
  savePrefs: NonNullable<SilenceDeps['savePrefs']>;
  exit: () => void;
  micDeviceId: () => string | undefined;
}

export interface SilenceContext {
  deps: ResolvedDeps;
  durationSec: SilenceDurationSec;
  difficulty: SilenceDifficulty;
  challenges: readonly string[];
  /** Calibration samples (dBFS) and elapsed seconds. */
  samples: number[];
  calibSec: number;
  baselineDb: number | null;
  /** null until calibration finished (the meter line is hidden). */
  thresholdDb: number | null;
  levelDb: number;
  leftSec: number;
  game: SilenceState;
  /** Level above threshold on the last frame. */
  over: boolean;
  /** Mascot bubble while playing. */
  bubble: string;
  /** Increments on every lost heart (drives shake + sad mouth). */
  hits: number;
  micError: MicErrorKind | null;
  /** Mic ended mid-game: retry continues the round instead of restarting it. */
  resumable: boolean;
  challengeText: string;
  rolls: number;
}

export type SilenceEvent =
  | { type: 'START' }
  | { type: 'CONFIGURE'; durationSec: SilenceDurationSec; difficulty: SilenceDifficulty }
  | { type: 'SET_DURATION'; durationSec: SilenceDurationSec }
  | { type: 'SET_DIFFICULTY'; difficulty: SilenceDifficulty }
  | { type: 'SET_CHALLENGES'; texts: readonly string[] }
  | { type: 'MIC_READY' }
  | { type: 'LEVEL'; dbfs: number; dt: number }
  | { type: 'NUDGE_UP' }
  | { type: 'NUDGE_DOWN' }
  | { type: 'OPTION'; n: number }
  | { type: 'RETRY' }
  | { type: 'EXIT' }
  | { type: 'MIC_ERROR'; kind: MicErrorKind };

interface MicInput {
  audio: AudioPort;
  now: () => number;
  deviceId: string | undefined;
}

/** Opens the mic, forwards levels as LEVEL(dbfs, dt) and failures as MIC_ERROR. Cleanup closes the mic. */
const micListener = fromCallback<SilenceEvent, MicInput>(({ sendBack, input }) => {
  let handle: MicHandle | null = null;
  let disposed = false;
  const offs: Array<() => void> = [];
  input.audio.openMic(input.deviceId).then(
    (h) => {
      if (disposed) {
        h.close();
        return;
      }
      handle = h;
      let last = input.now();
      offs.push(
        h.onLevel((dbfs) => {
          const t = input.now();
          const dt = Math.min(MAX_LEVEL_DT, Math.max(0, (t - last) / 1000));
          last = t;
          sendBack({ type: 'LEVEL', dbfs, dt });
        }),
        h.onError((err) => sendBack({ type: 'MIC_ERROR', kind: err.kind })),
      );
      sendBack({ type: 'MIC_READY' });
    },
    (err: unknown) => {
      if (!disposed) sendBack({ type: 'MIC_ERROR', kind: err instanceof MicError ? err.kind : 'unsupported' });
    },
  );
  return () => {
    disposed = true;
    offs.forEach((off) => off());
    handle?.close();
  };
});

const pick = (texts: readonly string[], rng: () => number): string => {
  const list = texts.length ? texts : DEFAULT_FUN_CHALLENGES;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))] ?? '';
};

const freshRound = (ctx: SilenceContext): Partial<SilenceContext> => ({
  samples: [],
  calibSec: 0,
  baselineDb: null,
  thresholdDb: null,
  leftSec: ctx.durationSec,
  game: initialSilenceState(),
  over: false,
  bubble: SILENCE_TEXT.start,
  hits: 0,
  micError: null,
  resumable: false,
  challengeText: '',
  rolls: 0,
});

export const silenceMachine = setup({
  types: {
    context: {} as SilenceContext,
    events: {} as SilenceEvent,
    input: {} as SilenceInput,
  },
  actors: { micListener },
  delays: {
    rollDelay: ({ context }) => challengeRollDelayMs(context.rolls),
  },
  actions: {
    newRound: assign(({ context }) => {
      context.deps.audio.ensure();
      // Không phát nhạc nền trong lúc chơi: mic sẽ thu tiếng loa.
      context.deps.audio.stopMusic();
      return freshRound(context);
    }),
    savePrefs: ({ context }) =>
      context.deps.savePrefs({ silenceDurationSec: context.durationSec, silenceDifficulty: context.difficulty }),
    makeHarder: assign(({ context }) => {
      const next = harderSilence({ durationSec: context.durationSec, difficulty: context.difficulty });
      context.deps.notify(SILENCE_TEXT.harder(next.durationSec, next.difficulty));
      return next;
    }),
    calibrate: assign(({ context, event }) => {
      if (event.type !== 'LEVEL') return {};
      return { levelDb: event.dbfs, samples: [...context.samples, event.dbfs], calibSec: context.calibSec + event.dt };
    }),
    finishCalibration: assign(({ context }) => {
      const baselineDb = median(context.samples);
      const thresholdDb = computeThreshold({ baselineDb, difficulty: context.difficulty });
      if (isNoisyBaseline(baselineDb)) context.deps.notify(SILENCE_TEXT.noisyBaseline);
      context.deps.audio.sfx('tick');
      return { baselineDb, thresholdDb, bubble: SILENCE_TEXT.start, over: false };
    }),
    play: assign(({ context, event }) => {
      if (event.type !== 'LEVEL' || context.thresholdDb == null) return {};
      const step = silenceStep(context.game, { dt: event.dt, levelDb: event.dbfs, thresholdDb: context.thresholdDb });
      const hearts = step.state.hearts;
      let bubble = context.bubble;
      if (step.over !== context.over) {
        if (step.over) bubble = SILENCE_TEXT.noisy;
        else if (hearts > 0) bubble = SILENCE_TEXT.quiet;
      }
      let hits = context.hits;
      if (step.lostHeart) {
        hits += 1;
        context.deps.audio.sfx('beep');
        if (hearts > 0) bubble = SILENCE_TEXT.hearts(hearts);
      }
      return {
        levelDb: event.dbfs,
        game: step.state,
        over: step.over,
        bubble,
        hits,
        leftSec: Math.max(0, context.leftSec - event.dt),
      };
    }),
    nudge: assign(({ context, event }) => {
      if (context.thresholdDb == null || (event.type !== 'NUDGE_UP' && event.type !== 'NUDGE_DOWN')) return {};
      const dir = event.type === 'NUDGE_UP' ? 'up' : 'down';
      const thresholdDb = nudgeThreshold(context.thresholdDb, dir);
      context.deps.notify(
        thresholdDb === context.thresholdDb ? SILENCE_TEXT.nudgeLimit : dir === 'up' ? SILENCE_TEXT.nudgeUp : SILENCE_TEXT.nudgeDown,
      );
      return { thresholdDb };
    }),
    pop: ({ context }) => context.deps.audio.sfx('pop'),
    win: ({ context }) => {
      context.deps.audio.sfx('win');
      context.deps.celebrate();
    },
    rollChallenge: assign(({ context }) => {
      context.deps.audio.sfx('tick');
      return { challengeText: pick(context.challenges, context.deps.rng), rolls: context.rolls + 1 };
    }),
    tada: ({ context }) => context.deps.audio.sfx('tada'),
    exit: ({ context }) => context.deps.exit(),
  },
  guards: {
    calibrated: ({ context }) => context.calibSec >= CALIBRATION_SEC,
    outOfHearts: ({ context }) => context.game.hearts <= 0,
    timeUp: ({ context }) => context.leftSec <= 0,
    resumable: ({ context }) => context.resumable && context.thresholdDb != null,
    lastRoll: ({ context }) => context.rolls >= CHALLENGE_ROLLS - 1,
    option: ({ event }, n: number) => event.type === 'OPTION' && event.n === n,
  },
}).createMachine({
  id: 'silence',
  context: ({ input }) => {
    const durationSec = input.durationSec ?? DEFAULT_USER_PREFS.silenceDurationSec;
    const ctx: SilenceContext = {
      deps: {
        audio: input.audio,
        now: input.now ?? (() => performance.now()),
        rng: input.rng ?? Math.random,
        notify: input.notify ?? (() => {}),
        celebrate: input.celebrate ?? (() => {}),
        savePrefs: input.savePrefs ?? (() => {}),
        exit: input.exit ?? (() => {}),
        micDeviceId: input.micDeviceId ?? (() => undefined),
      },
      durationSec,
      difficulty: input.difficulty ?? DEFAULT_USER_PREFS.silenceDifficulty,
      challenges: input.challenges ?? DEFAULT_FUN_CHALLENGES,
      samples: [],
      calibSec: 0,
      baselineDb: null,
      thresholdDb: null,
      levelDb: -100,
      leftSec: durationSec,
      game: initialSilenceState(),
      over: false,
      bubble: SILENCE_TEXT.start,
      hits: 0,
      micError: null,
      resumable: false,
      challengeText: '',
      rolls: 0,
    };
    return ctx;
  },
  on: {
    SET_CHALLENGES: { actions: assign({ challenges: ({ event }) => event.texts }) },
  },
  initial: 'setup',
  states: {
    setup: {
      on: {
        CONFIGURE: {
          actions: assign(({ event }) => ({ durationSec: event.durationSec, difficulty: event.difficulty, leftSec: event.durationSec })),
        },
        SET_DURATION: { actions: assign(({ event }) => ({ durationSec: event.durationSec, leftSec: event.durationSec })) },
        SET_DIFFICULTY: { actions: assign({ difficulty: ({ event }) => event.difficulty }) },
        START: { target: 'live', actions: ['savePrefs', 'newRound'] },
        EXIT: 'exited',
      },
    },
    live: {
      invoke: {
        src: 'micListener',
        input: ({ context }) => ({ audio: context.deps.audio, now: context.deps.now, deviceId: context.deps.micDeviceId() }),
      },
      on: {
        MIC_ERROR: { target: 'micError', actions: assign({ micError: ({ event }) => event.kind }) },
        EXIT: 'setup',
      },
      initial: 'requestingMic',
      states: {
        requestingMic: {
          on: {
            MIC_READY: [{ guard: 'resumable', target: 'playing', actions: assign({ resumable: false, micError: null }) }, { target: 'calibrating' }],
          },
        },
        calibrating: {
          on: { LEVEL: { actions: 'calibrate' } },
          always: { guard: 'calibrated', target: 'playing', actions: 'finishCalibration' },
        },
        playing: {
          on: {
            LEVEL: { actions: 'play' },
            NUDGE_UP: { actions: 'nudge' },
            NUDGE_DOWN: { actions: 'nudge' },
            // Mic rút ra giữa chừng: tạm dừng, giữ nguyên mạng và thời gian.
            MIC_ERROR: { target: '#silence.micError', actions: assign({ micError: ({ event }) => event.kind, resumable: true }) },
          },
          always: [
            { guard: 'outOfHearts', target: '#silence.popped' },
            { guard: 'timeUp', target: '#silence.won' },
          ],
        },
      },
    },
    micError: {
      on: {
        RETRY: [
          { guard: 'resumable', target: 'live' },
          { target: 'live', actions: 'newRound' },
        ],
        START: [
          { guard: 'resumable', target: 'live' },
          { target: 'live', actions: 'newRound' },
        ],
        EXIT: 'setup',
      },
    },
    popped: {
      entry: 'pop',
      on: { EXIT: 'setup' },
      initial: 'bursting',
      states: {
        bursting: { after: { [POP_OPTIONS_DELAY_MS]: 'choose' } },
        choose: {
          on: {
            OPTION: [
              { guard: { type: 'option', params: 1 }, target: '#silence.live', actions: 'newRound' },
              { guard: { type: 'option', params: 2 }, target: '#silence.live', actions: ['makeHarder', 'savePrefs', 'newRound'] },
              { guard: { type: 'option', params: 3 }, target: '#silence.challenge' },
              { guard: { type: 'option', params: 4 }, target: '#silence.exited' },
            ],
          },
        },
      },
    },
    challenge: {
      entry: [assign({ rolls: 0 }), 'rollChallenge'],
      on: {
        OPTION: [
          { guard: { type: 'option', params: 1 }, target: 'live', actions: 'newRound' },
          { guard: { type: 'option', params: 4 }, target: 'exited' },
        ],
        EXIT: 'setup',
      },
      initial: 'rolling',
      states: {
        rolling: {
          after: {
            rollDelay: [
              { guard: 'lastRoll', target: 'done', actions: ['rollChallenge', 'tada'] },
              { target: 'rolling', reenter: true, actions: 'rollChallenge' },
            ],
          },
        },
        done: {},
      },
    },
    won: {
      entry: 'win',
      on: {
        START: { target: 'live', actions: 'newRound' },
        EXIT: 'setup',
      },
      initial: 'flying',
      states: {
        flying: { after: { [WIN_CARD_DELAY_MS]: 'card' } },
        card: {},
      },
    },
    exited: { type: 'final', entry: 'exit' },
  },
});

export type SilenceMachine = typeof silenceMachine;
