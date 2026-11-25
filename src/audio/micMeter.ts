// Microphone level meter for the silence game, test-mic and TV check (SPEC 3.5 "Kỹ thuật mic").
// AnalyserNode → RMS per frame → dBFS = 20·log10(rms) → ~300 ms moving average.
// The stream is only analysed, never recorded or stored.
import { ensureAudio } from './context';
import { MicError, type MicHandle } from './types';

/** Floor for silence / digital zero. */
export const DBFS_FLOOR = -100;
/** Smoothing window (SPEC: ~300 ms). */
export const SMOOTHING_MS = 300;
/** Meter display range (SPEC: −70 → −10 dBFS maps to 0–100 %). */
export const METER_MIN_DBFS = -70;
export const METER_MAX_DBFS = -10;

/**
 * Mandatory: browser processing off. With AGC on, Chrome lowers mic gain as the class gets
 * louder and the game becomes almost impossible to lose.
 */
export const MIC_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} as const satisfies MediaTrackConstraints;

// ---------------------------------------------------------------- pure helpers

export function rms(samples: ArrayLike<number>): number {
  const n = samples.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

export function rmsToDbfs(r: number, floor: number = DBFS_FLOOR): number {
  if (!(r > 0)) return floor;
  return Math.max(floor, 20 * Math.log10(r));
}

/** Maps a dBFS level to 0–100 for the meter bar (clamped). */
export function dbfsToPercent(dbfs: number, min: number = METER_MIN_DBFS, max: number = METER_MAX_DBFS): number {
  if (!Number.isFinite(dbfs)) return 0;
  return Math.max(0, Math.min(100, ((dbfs - min) / (max - min)) * 100));
}

/** Time-windowed moving average: mean of samples whose timestamp is within `windowMs` of the newest. */
export class MovingAverage {
  private readonly samples: { t: number; v: number }[] = [];
  private sum = 0;
  constructor(private readonly windowMs: number = SMOOTHING_MS) {}

  push(value: number, timeMs: number): number {
    this.samples.push({ t: timeMs, v: value });
    this.sum += value;
    while (this.samples.length > 1) {
      const first = this.samples[0];
      if (!first || timeMs - first.t <= this.windowMs) break;
      this.samples.shift();
      this.sum -= first.v;
    }
    return this.value;
  }

  get value(): number {
    return this.samples.length === 0 ? DBFS_FLOOR : this.sum / this.samples.length;
  }

  reset(): void {
    this.samples.length = 0;
    this.sum = 0;
  }
}

/** Maps a getUserMedia failure to our error kinds. */
export function toMicError(e: unknown): MicError {
  if (e instanceof MicError) return e;
  const name =
    e instanceof Error || (typeof e === 'object' && e !== null && 'name' in e)
      ? String((e as { name: unknown }).name)
      : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new MicError('denied');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'NotReadableError':
    case 'TrackStartError':
      return new MicError('no-device');
    default:
      return new MicError('unsupported', e instanceof Error ? e.message : undefined);
  }
}

// ---------------------------------------------------------------- live meter

const FRAME_MS = 1000 / 60;

/**
 * Opens the microphone (optionally a specific device) and starts metering.
 * Rejects with `MicError` ('denied' | 'no-device' | 'unsupported').
 */
export async function openMic(deviceId?: string): Promise<MicHandle> {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!md || typeof md.getUserMedia !== 'function') throw new MicError('unsupported');
  const ctx = ensureAudio();
  if (!ctx) throw new MicError('unsupported');

  let stream: MediaStream;
  try {
    stream = await md.getUserMedia({
      audio: { ...MIC_CONSTRAINTS, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
      video: false,
    });
  } catch (e) {
    throw toMicError(e);
  }
  const tracks = stream.getAudioTracks();
  if (tracks.length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    throw new MicError('no-device');
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser); // not connected to the destination: no feedback through the TV
  const buf = new Float32Array(analyser.fftSize);
  const avg = new MovingAverage(SMOOTHING_MS);

  const levelCbs = new Set<(dbfs: number) => void>();
  const errorCbs = new Set<(err: MicError) => void>();
  let closed = false;

  const frame = (): void => {
    if (closed) return;
    analyser.getFloatTimeDomainData(buf);
    const level = avg.push(rmsToDbfs(rms(buf)), performance.now());
    levelCbs.forEach((cb) => cb(level));
  };
  // setInterval (not rAF) so metering keeps a steady rate regardless of rendering.
  const timer = setInterval(frame, FRAME_MS);

  const onEnded = (): void => {
    if (closed) return;
    const err = new MicError('ended');
    handle.close();
    errorCbs.forEach((cb) => cb(err));
  };
  tracks.forEach((t) => t.addEventListener('ended', onEnded));

  const handle: MicHandle = {
    onLevel(cb) {
      levelCbs.add(cb);
      return () => levelCbs.delete(cb);
    },
    onError(cb) {
      errorCbs.add(cb);
      return () => errorCbs.delete(cb);
    },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      tracks.forEach((t) => t.removeEventListener('ended', onEnded));
      stream.getTracks().forEach((t) => t.stop());
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // already disconnected
      }
      levelCbs.clear();
    },
    get closed() {
      return closed;
    },
  };
  return handle;
}
