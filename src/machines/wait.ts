// "Màn hình chờ" countdown (SPEC 3.6, mockup waitStart/waitRender/waitAdjust).
// The clock is injected (`deps.now`) and ticks come from an interval actor, so tests use fake timers.
import { assign, fromCallback, setup } from 'xstate';
import type { AudioPort } from '@/audio/types';
import { DEFAULT_USER_PREFS } from '@/domain/defaults';

/** Tick period of the countdown (mockup: 100 ms). */
export const WAIT_TICK_MS = 100;
/** Last seconds shown big on yellow with a tick sound each second. */
export const WAIT_FINAL_SEC = 10;
/** + / − step. */
export const WAIT_ADJUST_SEC = 30;
export const WAIT_FADE_SEC = 1.5;
export const WAIT_MESSAGE_MAX = 60;
/** Banner when the message is empty (mockup). */
export const WAIT_FALLBACK_MESSAGE = 'Chuẩn bị nhé!';
export const WAIT_DONE_MESSAGE = 'Hết giờ rồi!';

export interface WaitDeps {
  audio: AudioPort;
  /** Milliseconds clock (default `performance.now`). */
  now?: () => number;
  /** Calm tracks already loaded (sync so music starts inside the key gesture). Empty → synth. */
  calmTracks?: () => readonly Blob[];
  savePrefs?: (prefs: { waitDurationSec: number; waitMessage: string }) => void;
  /** Leave to the launcher. */
  exit?: () => void;
}

export interface WaitInput extends WaitDeps {
  durationSec?: number;
  message?: string;
}

interface ResolvedDeps {
  audio: AudioPort;
  now: () => number;
  calmTracks: () => readonly Blob[];
  savePrefs: NonNullable<WaitDeps['savePrefs']>;
  exit: () => void;
}

export interface WaitContext {
  deps: ResolvedDeps;
  /** Setup choice. */
  durationSec: number;
  message: string;
  /** Running countdown. */
  totalSec: number;
  leftSec: number;
  /** Last whole second seen (for the per-second tick). */
  lastSec: number;
}

export type WaitEvent =
  | { type: 'CONFIGURE'; durationSec: number; message: string }
  | { type: 'SET_DURATION'; durationSec: number }
  | { type: 'SET_MESSAGE'; message: string }
  /** Space: start on setup, pause / resume while running. */
  | { type: 'TOGGLE' }
  | { type: 'ADJUST'; deltaSec: number }
  | { type: 'TICK'; dt: number }
  | { type: 'EXIT' };

/** Banner text while running. */
export const bannerText = (message: string): string => message.trim() || WAIT_FALLBACK_MESSAGE;

const ticker = fromCallback<WaitEvent, { now: () => number }>(({ sendBack, input }) => {
  let last = input.now();
  const id = setInterval(() => {
    const t = input.now();
    const dt = Math.max(0, (t - last) / 1000);
    last = t;
    sendBack({ type: 'TICK', dt });
  }, WAIT_TICK_MS);
  return () => clearInterval(id);
});

/** Calm music for the whole active period; stopping (end, Esc, unmount) fades out 1.5 s. */
const music = fromCallback<WaitEvent, { audio: AudioPort; tracks: readonly Blob[] }>(({ input }) => {
  void input.audio.startMusic('calm', input.tracks);
  return () => input.audio.stopMusic({ fadeSec: WAIT_FADE_SEC });
});

export const waitMachine = setup({
  types: {
    context: {} as WaitContext,
    events: {} as WaitEvent,
    input: {} as WaitInput,
  },
  actors: { ticker, music },
  actions: {
    begin: assign(({ context }) => {
      context.deps.audio.ensure();
      const message = context.message.slice(0, WAIT_MESSAGE_MAX);
      context.deps.savePrefs({ waitDurationSec: context.durationSec, waitMessage: message.trim() });
      return { message, totalSec: context.durationSec, leftSec: context.durationSec, lastSec: Math.ceil(context.durationSec) };
    }),
    tick: assign(({ context, event }) => {
      if (event.type !== 'TICK') return {};
      const leftSec = Math.max(0, context.leftSec - event.dt);
      const sec = Math.ceil(leftSec);
      if (sec !== context.lastSec && sec <= WAIT_FINAL_SEC && sec > 0) context.deps.audio.sfx('tick');
      return { leftSec, lastSec: sec };
    }),
    adjust: assign(({ context, event }) => {
      if (event.type !== 'ADJUST') return {};
      const leftSec = Math.max(1, context.leftSec + event.deltaSec);
      return { leftSec, totalSec: Math.max(context.totalSec, leftSec) };
    }),
    chime: ({ context }) => context.deps.audio.sfx('chime'),
    exit: ({ context }) => context.deps.exit(),
  },
  guards: {
    timeUp: ({ context }) => context.leftSec <= 0,
    adding: ({ event }) => event.type === 'ADJUST' && event.deltaSec > 0,
  },
}).createMachine({
  id: 'wait',
  context: ({ input }) => {
    const durationSec = input.durationSec ?? DEFAULT_USER_PREFS.waitDurationSec;
    return {
      deps: {
        audio: input.audio,
        now: input.now ?? (() => performance.now()),
        calmTracks: input.calmTracks ?? (() => []),
        savePrefs: input.savePrefs ?? (() => {}),
        exit: input.exit ?? (() => {}),
      },
      durationSec,
      message: input.message ?? DEFAULT_USER_PREFS.waitMessage,
      totalSec: durationSec,
      leftSec: durationSec,
      lastSec: Math.ceil(durationSec),
    };
  },
  on: { EXIT: '.exited' },
  initial: 'setup',
  states: {
    setup: {
      on: {
        CONFIGURE: { actions: assign(({ event }) => ({ durationSec: event.durationSec, message: event.message })) },
        SET_DURATION: { actions: assign({ durationSec: ({ event }) => event.durationSec }) },
        SET_MESSAGE: { actions: assign({ message: ({ event }) => event.message.slice(0, WAIT_MESSAGE_MAX) }) },
        TOGGLE: { target: 'active', actions: 'begin' },
      },
    },
    active: {
      invoke: { src: 'music', input: ({ context }) => ({ audio: context.deps.audio, tracks: context.deps.calmTracks() }) },
      on: { ADJUST: { actions: 'adjust' } },
      initial: 'running',
      states: {
        running: {
          invoke: { src: 'ticker', input: ({ context }) => ({ now: context.deps.now }) },
          on: { TICK: { actions: 'tick' }, TOGGLE: 'paused' },
          always: { guard: 'timeUp', target: '#wait.done' },
        },
        paused: { on: { TOGGLE: 'running' } },
      },
    },
    done: {
      entry: 'chime',
      on: {
        // + sau khi hết giờ: thêm 30 giây và chạy tiếp (nhạc bật lại).
        ADJUST: { guard: 'adding', target: 'active', actions: 'adjust' },
      },
    },
    exited: { type: 'final', entry: 'exit' },
  },
});

export type WaitMachine = typeof waitMachine;
