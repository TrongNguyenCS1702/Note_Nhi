// Test doubles for the audio layer: records every call and provides a scriptable mic.
// No Web Audio needed, so it works in jsdom component/machine tests.
import { clampVolume, DEFAULT_VOLUME } from './context';
import { MicError, type AudioPort, type MicErrorKind, type MicHandle, type Mood, type MusicSource } from './types';

export type AudioMethod = keyof AudioPort;

export interface AudioCall {
  method: AudioMethod;
  args: unknown[];
}

export interface FakeMicOptions {
  /** Levels (dBFS) emitted one per `intervalMs` after the mic opens. */
  levels?: readonly number[];
  /** Default ~60 fps. */
  intervalMs?: number;
  /** Make `openMic` reject with this kind. */
  error?: MicErrorKind;
}

export interface FakeAudioOptions {
  /** Forces the value `startMusic` resolves to (default: 'track' if tracks were given, else 'synth'). */
  musicSource?: MusicSource;
  mic?: FakeMicOptions;
}

/** A mic handle whose levels are driven by the test. */
export class FakeMicHandle implements MicHandle {
  private readonly levelCbs = new Set<(dbfs: number) => void>();
  private readonly errorCbs = new Set<(err: MicError) => void>();
  private readonly queue: number[];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isClosed = false;
  /** Every level emitted so far. */
  readonly emitted: number[] = [];

  constructor(
    readonly deviceId: string | undefined,
    levels: readonly number[] = [],
    private readonly intervalMs: number = 1000 / 60,
  ) {
    this.queue = [...levels];
  }

  get closed(): boolean {
    return this.isClosed;
  }

  onLevel(cb: (dbfs: number) => void): () => void {
    this.levelCbs.add(cb);
    return () => this.levelCbs.delete(cb);
  }

  onError(cb: (err: MicError) => void): () => void {
    this.errorCbs.add(cb);
    return () => this.errorCbs.delete(cb);
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.levelCbs.clear();
  }

  /** Emits one level now (ignored once closed). */
  emit(dbfs: number): void {
    if (this.isClosed) return;
    this.emitted.push(dbfs);
    this.levelCbs.forEach((cb) => cb(dbfs));
  }

  /** Queues more scripted levels and (re)starts the timer. */
  script(levels: readonly number[]): void {
    this.queue.push(...levels);
    this.schedule();
  }

  /** Emits every queued level synchronously (no timers needed). */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    while (this.queue.length > 0 && !this.isClosed) this.emit(this.queue.shift() as number);
  }

  /** Simulates the mic being unplugged: notifies `onError('ended')` and closes. */
  end(): void {
    if (this.isClosed) return;
    const err = new MicError('ended');
    const cbs = [...this.errorCbs];
    this.close();
    cbs.forEach((cb) => cb(err));
  }

  /** @internal starts timed emission of the queue. */
  schedule(): void {
    if (this.timer || this.isClosed || this.queue.length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.queue.shift();
      if (next !== undefined) this.emit(next);
      this.schedule();
    }, this.intervalMs);
  }
}

export interface FakeAudio extends AudioPort {
  /** Every call in order. */
  readonly calls: AudioCall[];
  /** Calls of one method (args only). */
  callsOf(method: AudioMethod): unknown[][];
  /** Currently "playing" music, or null. */
  readonly music: { mood: Mood; source: MusicSource } | null;
  /** Mics opened so far (latest last). */
  readonly mics: FakeMicHandle[];
  /** Latest opened mic. */
  readonly mic: FakeMicHandle | undefined;
  /** Changes how the next `openMic` calls behave. */
  setMicOptions(opts: FakeMicOptions): void;
  reset(): void;
}

export function createFakeAudio(options: FakeAudioOptions = {}): FakeAudio {
  const calls: AudioCall[] = [];
  const mics: FakeMicHandle[] = [];
  let micOpts: FakeMicOptions = options.mic ?? {};
  let volume = DEFAULT_VOLUME;
  let muted = false;
  let music: { mood: Mood; source: MusicSource } | null = null;

  const rec = (method: AudioMethod, ...args: unknown[]): void => {
    calls.push({ method, args });
  };

  return {
    calls,
    mics,
    get music() {
      return music;
    },
    get mic() {
      return mics[mics.length - 1];
    },
    callsOf: (method) => calls.filter((c) => c.method === method).map((c) => c.args),
    setMicOptions(opts) {
      micOpts = opts;
    },
    reset() {
      calls.length = 0;
      mics.length = 0;
      music = null;
      volume = DEFAULT_VOLUME;
      muted = false;
    },

    ensure: () => rec('ensure'),
    startMusic(mood, tracks) {
      rec('startMusic', mood, tracks);
      const source = options.musicSource ?? (tracks && tracks.length > 0 ? 'track' : 'synth');
      music = source === 'none' ? null : { mood, source };
      return Promise.resolve(source);
    },
    stopMusic(opts) {
      rec('stopMusic', opts);
      music = null;
    },
    sfx: (name) => rec('sfx', name),
    step: (i) => rec('step', i),
    roll: (d) => rec('roll', d),
    getVolume: () => volume,
    setVolume(v) {
      rec('setVolume', v);
      volume = clampVolume(v);
      return volume;
    },
    isMuted: () => muted,
    setMuted(m) {
      rec('setMuted', m);
      muted = m;
    },
    openMic(deviceId) {
      rec('openMic', deviceId);
      if (micOpts.error) return Promise.reject(new MicError(micOpts.error));
      const h = new FakeMicHandle(deviceId, micOpts.levels, micOpts.intervalMs);
      mics.push(h);
      h.schedule();
      return Promise.resolve(h);
    },
  };
}
