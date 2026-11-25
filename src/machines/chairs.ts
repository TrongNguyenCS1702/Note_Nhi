// Ghế âm nhạc (musical chairs) game flow — XState v5.
// The result is decided BEFORE any animation (fair picker) and logged immediately;
// the reveal animation is only presentation and reports back with ANIM_* events.
import { assign, setup, type SnapshotFrom } from 'xstate';
import type { AudioPort } from '@/audio/types';
import type { CallMethod } from '@/domain/schemas';

export const METHODS: readonly CallMethod[] = ['chase', 'spot', 'ball', 'claw'];

/** Banner tick delays (mockup `announce`: 10 ticks of 55 + i·14 ms, then the chosen name for 1 s). */
export const INTRO_TICKS_MS: readonly number[] = Array.from({ length: 10 }, (_, i) => 55 + i * 14);
export const INTRO_HOLD_MS = 1000;
export const INTRO_MS = INTRO_TICKS_MS.reduce((a, b) => a + b, 0) + INTRO_HOLD_MS;
/** Music auto-stop window: first pick 4–7 s, duo 2nd pick 1.8–2.8 s. */
export const AUTO_STOP_MS = { first: [4000, 7000], next: [1800, 2800] } as const;
/** Pause on the landed cell before the duo's 2nd round (mockup: tada + 1 s). */
export const BETWEEN_PICKS_MS = 1000;
/** Delay between the last landing and the result overlay. */
export const REVEAL_MS = 700;
/** Safety net if a reveal animation never reports back (e.g. rAF paused). */
export const SLOW_TIMEOUT_MS = 30000;
/** Probability of the fake-out stop per pick. */
export const FAKE_CHANCE = 0.5;
export const FAKEOUT_ROLL_SEC = 1.3;
export const NO_ONE_LEFT = 'Không còn bạn nào để gọi';

export interface ChairsServices {
  audio: AudioPort;
  /** Fair pick (domain `pickStudents`) among present students; returns up to `count` distinct ids. */
  pick(count: number, exclude: readonly string[]): string[];
  /** Write a CallLog (status 'called') right away; resolves to its id. */
  log(studentId: string, method: CallMethod): Promise<string>;
  setStatus(logId: string, status: 'skipped' | 'absent'): Promise<unknown>;
  /** Mark the student absent in today's session (and tell the teacher). */
  markAbsent(studentId: string): Promise<unknown>;
  /** Lively track blobs from the DB (empty → synth fallback). */
  tracks(): readonly Blob[];
  notify(message: string): void;
  rng(): number;
  now(): number;
  onError?(err: unknown): void;
}

export interface ChairsPick {
  studentId: string;
  /** CallLog id (null if the write failed). */
  logId: Promise<string | null>;
}

export interface ChairsContext {
  services: ChairsServices;
  duo: boolean;
  picks: ChairsPick[];
  /** Which pick (0 or 1) is being revealed. */
  pickIndex: number;
  method: CallMethod | null;
  lastMethod: CallMethod | null;
  /** Fake-out decision per pick (the reveal may skip it when geometry doesn't allow). */
  fakes: boolean[];
  autoStopMs: number;
  /** Increments on every spin so animations can tell spins apart. */
  spinId: number;
  spinStartedAt: number;
  /** Students marked absent with V while on this screen. */
  absentMarked: string[];
}

export type ChairsEvent =
  | { type: 'SPACE' }
  | { type: 'REROLL' }
  | { type: 'ABSENT' }
  | { type: 'CONTINUE' }
  | { type: 'TOGGLE_DUO' }
  | { type: 'EXIT' }
  | { type: 'ANIM_FAKEOUT' }
  | { type: 'ANIM_LANDED' };

export interface ChairsInput {
  services: ChairsServices;
  duo?: boolean;
}

const between = (rng: () => number, [a, b]: readonly [number, number]) => a + rng() * (b - a);

function chooseMethod(rng: () => number, last: CallMethod | null): CallMethod {
  const opts = METHODS.filter((m) => m !== last);
  return opts[Math.min(opts.length - 1, Math.floor(rng() * opts.length))] ?? 'chase';
}

function logSafely(s: ChairsServices, studentId: string, method: CallMethod): Promise<string | null> {
  try {
    return s.log(studentId, method).catch((e: unknown) => {
      s.onError?.(e);
      return null;
    });
  } catch (e) {
    s.onError?.(e);
    return Promise.resolve(null);
  }
}

function markLogs(s: ChairsServices, picks: readonly ChairsPick[], status: 'skipped' | 'absent'): void {
  for (const p of picks) {
    void p.logId.then((id) => (id ? s.setStatus(id, status) : undefined)).catch((e: unknown) => s.onError?.(e));
  }
}

/** Pick + log + choose method for a new spin. `exclude` = students left out (R/V). */
function beginSpin(context: ChairsContext, exclude: readonly string[]): Partial<ChairsContext> {
  const s = context.services;
  const ids = s.pick(context.duo ? 2 : 1, [...new Set([...exclude, ...context.absentMarked])]);
  if (ids.length === 0) return { picks: [], method: null };
  const method = chooseMethod(s.rng, context.lastMethod);
  const picks = ids.map((studentId) => ({ studentId, logId: logSafely(s, studentId, method) }));
  return {
    picks,
    method,
    lastMethod: method,
    pickIndex: 0,
    fakes: ids.map(() => s.rng() < FAKE_CHANCE),
    autoStopMs: 0,
    spinId: context.spinId + 1,
    spinStartedAt: s.now(),
  };
}

export const chairsMachine = setup({
  types: {
    context: {} as ChairsContext,
    events: {} as ChairsEvent,
    input: {} as ChairsInput,
  },
  actions: {
    ensureAudio: ({ context }) => context.services.audio.ensure(),
    startSpin: assign(({ context }) => beginSpin(context, [])),
    rerollSpin: assign(({ context }) => {
      markLogs(context.services, context.picks, 'skipped');
      return beginSpin(context, context.picks.map((p) => p.studentId));
    }),
    absentSpin: assign(({ context }) => {
      const s = context.services;
      const ids = context.picks.map((p) => p.studentId);
      markLogs(s, context.picks, 'absent');
      for (const id of ids) void Promise.resolve(s.markAbsent(id)).catch((e: unknown) => s.onError?.(e));
      return beginSpin(context, ids);
    }),
    // runs before absentSpin so the absent ids persist even when nobody is left
    rememberAbsent: assign({
      absentMarked: ({ context }) => [...new Set([...context.absentMarked, ...context.picks.map((p) => p.studentId)])],
    }),
    notifyEmpty: ({ context }) => context.services.notify(NO_ONE_LEFT),
    clearPicks: assign({ picks: [], method: null, pickIndex: 0, fakes: [] }),
    armAutoStop: assign({
      autoStopMs: ({ context }) =>
        between(context.services.rng, context.pickIndex === 0 ? AUTO_STOP_MS.first : AUTO_STOP_MS.next),
    }),
    startMusic: ({ context }) => {
      const s = context.services;
      void s.audio.startMusic('lively', s.tracks()).catch((e: unknown) => s.onError?.(e));
    },
    stopMusic: ({ context }) => context.services.audio.stopMusic(),
    roll: ({ context }) => context.services.audio.roll(FAKEOUT_ROLL_SEC),
    tada: ({ context }) => context.services.audio.sfx('tada'),
    nextPick: assign({ pickIndex: ({ context }) => context.pickIndex + 1 }),
    toggleDuo: assign({ duo: ({ context }) => !context.duo }),
  },
  guards: {
    hasPicks: ({ context }) => context.picks.length > 0,
    morePicks: ({ context }) => context.pickIndex < context.picks.length - 1,
    singlePick: ({ context }) => context.picks.length === 1,
  },
  delays: {
    intro: INTRO_MS,
    autoStop: ({ context }) => context.autoStopMs,
    betweenPicks: BETWEEN_PICKS_MS,
    reveal: REVEAL_MS,
    slowTimeout: SLOW_TIMEOUT_MS,
  },
}).createMachine({
  id: 'chairs',
  context: ({ input }) => ({
    services: input.services,
    duo: input.duo ?? false,
    picks: [],
    pickIndex: 0,
    method: null,
    lastMethod: null,
    fakes: [],
    autoStopMs: 0,
    spinId: 0,
    spinStartedAt: 0,
    absentMarked: [],
  }),
  initial: 'idle',
  on: {
    EXIT: { target: '.exited' },
  },
  states: {
    idle: {
      on: {
        SPACE: { target: 'starting', actions: ['ensureAudio', 'startSpin'] },
        TOGGLE_DUO: { actions: 'toggleDuo' },
      },
    },
    /** Transient: spin begins if somebody could be picked. */
    starting: {
      always: [
        { guard: 'hasPicks', target: 'intro' },
        { target: 'idle', actions: ['notifyEmpty', 'clearPicks'] },
      ],
    },
    /** Method banner. */
    intro: {
      after: { intro: 'fast' },
    },
    /** Music playing; SPACE = teacher stops the music early. */
    fast: {
      entry: ['armAutoStop', 'startMusic'],
      exit: 'stopMusic',
      after: { autoStop: 'slow' },
      on: { SPACE: 'slow' },
    },
    /** Music stopped, slowing down; SPACE = skip to the result. */
    slow: {
      after: { slowTimeout: 'revealing' },
      on: {
        SPACE: 'revealing',
        ANIM_FAKEOUT: 'fakeout',
        ANIM_LANDED: 'landed',
      },
    },
    /** "Dừng ở… ?" — drum roll, then a nudge onto the real winner. */
    fakeout: {
      entry: 'roll',
      after: { slowTimeout: 'revealing' },
      on: {
        SPACE: 'revealing',
        ANIM_LANDED: 'landed',
      },
    },
    landed: {
      always: [{ guard: 'morePicks', target: 'between' }, { target: 'revealing' }],
    },
    /** Duo: pause on the 1st winner, then another music round. */
    between: {
      entry: 'tada',
      after: { betweenPicks: { target: 'fast', actions: 'nextPick' } },
      on: { SPACE: 'revealing' },
    },
    /** Winner flashed; overlay comes after a short beat. */
    revealing: {
      after: { reveal: 'result' },
    },
    result: {
      entry: 'tada',
      on: {
        SPACE: { target: 'idle', actions: 'clearPicks' },
        CONTINUE: { target: 'idle', actions: 'clearPicks' },
        REROLL: { target: 'starting', actions: 'rerollSpin' },
        ABSENT: { guard: 'singlePick', target: 'starting', actions: ['rememberAbsent', 'absentSpin'] },
      },
    },
    exited: {
      entry: 'stopMusic',
      type: 'final',
    },
  },
});

export type ChairsSnapshot = SnapshotFrom<typeof chairsMachine>;
export type ChairsPhase = 'idle' | 'starting' | 'intro' | 'fast' | 'slow' | 'fakeout' | 'landed' | 'between' | 'revealing' | 'result' | 'exited';

export const phaseOf = (s: ChairsSnapshot): ChairsPhase => s.value as ChairsPhase;

/** Phases during which a spin is on screen (grid frozen, reveal animation alive). */
export const SPIN_PHASES: ReadonlySet<ChairsPhase> = new Set(['intro', 'fast', 'slow', 'fakeout', 'landed', 'between']);

/** Spin button label (mockup: Quay → Dừng nhạc → Tua nhanh). */
export function spinLabel(phase: ChairsPhase): string {
  if (phase === 'fast') return 'Dừng nhạc';
  if (phase === 'slow' || phase === 'fakeout' || phase === 'between') return 'Tua nhanh';
  return 'Quay';
}
