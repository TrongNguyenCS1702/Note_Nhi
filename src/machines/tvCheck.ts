import { assign, fromCallback, setup } from 'xstate';

// Kiểm tra nhanh trên TV (SPEC 3.12): loa → 4 góc màn hình → mic. Each step is one key,
// Esc skips everything. Side effects are named actions; the screen supplies them via `.provide()`.

/** First smoothed mic level above this counts as "Mic nghe rõ rồi!". */
export const MIC_HEARD_DBFS = -35;
/** Volume change per ↑ / ↓ press. */
export const VOLUME_STEP = 0.1;

export type TvCheckMicError = 'denied' | 'no-device' | 'ended' | 'unsupported';

export interface TvCheckContext {
  /** Teacher pressed L at least once (safe margin turned on). */
  cropped: boolean;
  /** Last mic failure, null while OK. */
  micError: TvCheckMicError | null;
  /** Latest mic level (dBFS) for the meter. */
  level: number;
}

export type TvCheckEvent =
  | { type: 'NEXT' }
  | { type: 'SKIP' }
  | { type: 'VOLUME_UP' }
  | { type: 'VOLUME_DOWN' }
  | { type: 'CROPPED' }
  | { type: 'MIC_READY' }
  | { type: 'MIC_ERROR'; kind: TvCheckMicError }
  | { type: 'MIC_LEVEL'; dbfs: number }
  | { type: 'RETRY_MIC' };

/** Step number (1-based) shown as "1/3" for a state value. */
export const TV_CHECK_STEPS = ['speaker', 'corners', 'mic'] as const;
export type TvCheckStep = (typeof TV_CHECK_STEPS)[number];

export const tvCheckMachine = setup({
  types: {
    context: {} as TvCheckContext,
    events: {} as TvCheckEvent,
  },
  actions: {
    startMusic: () => {},
    stopMusic: () => {},
    changeVolume: (_, _params: { delta: number }) => {},
    enableSafeMargin: () => {},
    micHeard: () => {},
    finish: (_, _params: { skipped: boolean }) => {},
  },
  actors: {
    /**
     * Opens the microphone while running and closes it when stopped. Sends back MIC_READY,
     * MIC_LEVEL and MIC_ERROR. The screen provides the real one (audio.openMic).
     */
    mic: fromCallback<TvCheckEvent>(() => () => {}),
  },
  guards: {
    isLoud: ({ event }) => event.type === 'MIC_LEVEL' && event.dbfs > MIC_HEARD_DBFS,
  },
}).createMachine({
  id: 'tvCheck',
  initial: 'speaker',
  context: { cropped: false, micError: null, level: -100 },
  on: {
    SKIP: '.skipped',
  },
  states: {
    speaker: {
      entry: 'startMusic',
      exit: 'stopMusic',
      on: {
        NEXT: 'corners',
        VOLUME_UP: { actions: { type: 'changeVolume', params: { delta: VOLUME_STEP } } },
        VOLUME_DOWN: { actions: { type: 'changeVolume', params: { delta: -VOLUME_STEP } } },
      },
    },
    corners: {
      on: {
        NEXT: 'mic',
        CROPPED: { actions: [assign({ cropped: true }), 'enableSafeMargin'] },
      },
    },
    mic: {
      initial: 'active',
      on: { NEXT: 'done' },
      states: {
        active: {
          invoke: { src: 'mic' },
          initial: 'opening',
          on: {
            MIC_ERROR: { target: 'failed', actions: assign({ micError: ({ event }) => event.kind }) },
          },
          states: {
            opening: {
              on: { MIC_READY: 'listening' },
            },
            listening: {
              on: {
                MIC_LEVEL: [
                  { guard: 'isLoud', target: 'heard', actions: [assign({ level: ({ event }) => event.dbfs }), 'micHeard'] },
                  { actions: assign({ level: ({ event }) => event.dbfs }) },
                ],
              },
            },
            heard: {
              on: { MIC_LEVEL: { actions: assign({ level: ({ event }) => event.dbfs }) } },
            },
          },
        },
        failed: {
          entry: assign({ level: -100 }),
          on: {
            RETRY_MIC: { target: 'active', actions: assign({ micError: null }) },
          },
        },
      },
    },
    done: { type: 'final', entry: { type: 'finish', params: { skipped: false } } },
    skipped: { type: 'final', entry: { type: 'finish', params: { skipped: true } } },
  },
});
