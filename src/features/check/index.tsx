import { useMachine } from '@xstate/react';
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore } from '@/app/store';
import { fromCallback } from 'xstate';
import { audio, dbfsToPercent, MicError } from '@/audio';
import { getTrackBlob, listTracks, logError, setTvCheckDoneAt, updateDevicePrefs } from '@/db';
import { tvCheckMachine, type TvCheckEvent, type TvCheckMicError } from '@/machines/tvCheck';
import { Button, Eyebrow, Mascot, toast, type MascotMood } from '@/ui';

const TITLES = {
  speaker: 'Loa TV nghe rõ không?',
  corners: 'Thấy đủ 4 góc đỏ không?',
  mic: 'Vỗ tay thử xem mic có nghe không',
} as const;

const MIC_HELP: Record<TvCheckMicError, string> = {
  denied: 'Trình duyệt đang chặn micro. Bấm biểu tượng ổ khoá cạnh thanh địa chỉ → Micro → Cho phép, rồi bấm "Thử lại".',
  'no-device': 'Không tìm thấy micro. Kiểm tra dây cắm hoặc micro của laptop rồi bấm "Thử lại".',
  ended: 'Micro vừa bị ngắt. Cắm lại rồi bấm "Thử lại".',
  unsupported: 'Trình duyệt này không dùng được micro. Hãy mở app bằng Chrome hoặc Edge.',
};

const KEY_EVENTS: Record<string, TvCheckEvent> = {
  Enter: { type: 'NEXT' },
  Escape: { type: 'SKIP' },
  ArrowUp: { type: 'VOLUME_UP' },
  ArrowDown: { type: 'VOLUME_DOWN' },
  l: { type: 'CROPPED' },
};

async function livelyBlobs(): Promise<Blob[]> {
  const tracks = await listTracks('lively');
  const blobs = await Promise.all(tracks.map((t) => getTrackBlob(t.fileId)));
  return blobs.filter((b): b is Blob => b !== undefined);
}

/** Opens the mic while the machine is in `mic.active`; closing happens when the state is left. */
const micActor = fromCallback<TvCheckEvent>(({ sendBack }) => {
  let closed = false;
  let close = () => {};
  audio
    .openMic()
    .then((mic) => {
      if (closed) return mic.close();
      close = () => mic.close();
      mic.onLevel((dbfs) => sendBack({ type: 'MIC_LEVEL', dbfs }));
      mic.onError((err) => sendBack({ type: 'MIC_ERROR', kind: err.kind }));
      sendBack({ type: 'MIC_READY' });
    })
    .catch((e: unknown) => {
      if (!closed) sendBack({ type: 'MIC_ERROR', kind: e instanceof MicError ? e.kind : 'unsupported' });
    });
  return () => {
    closed = true;
    close();
  };
});

/** Kiểm tra nhanh trên TV (SPEC 3.12), shown before roll call on the first lesson. */
export function CheckScreen() {
  const machine = useMemo(
    () =>
      tvCheckMachine.provide({
        actions: {
          startMusic: () => {
            audio.ensure();
            void livelyBlobs()
              .catch(() => [])
              .then((blobs) => audio.startMusic('lively', blobs));
          },
          stopMusic: () => audio.stopMusic(),
          changeVolume: (_, { delta }) => {
            const v = audio.setVolume(audio.getVolume() + delta);
            void updateDevicePrefs({ volume: v });
            toast(`Âm lượng: ${Math.round(v * 100)}%`);
          },
          enableSafeMargin: () => {
            useAppStore.getState().setSafeMargin(true);
            void updateDevicePrefs({ tvSafeMargin: true });
            toast('Đã bật lề an toàn TV. Giờ thấy đủ 4 góc chưa?');
          },
          micHeard: () => {
            audio.sfx('chime');
            toast('Mic nghe rõ rồi! Bấm Enter để xong');
          },
          finish: (_, { skipped }) => {
            void setTvCheckDoneAt().catch((e: unknown) => logError({ screen: 'check', message: String(e) }));
            toast(skipped ? 'Đã bỏ qua. Chạy lại được trong Cài đặt' : 'Xong phần kiểm tra! Lần sau không hiện lại nữa');
            if (!skipped) audio.sfx('tada');
            // TODO(home): replace with the home feature's routeAfterCheck() once merged.
            useAppStore.getState().go('prep');
          },
        },
        actors: { mic: micActor },
      }),
    [],
  );
  const [snap, send] = useMachine(machine);

  // Leaving the screen any other way (error boundary, app bar) still stops the music;
  // the mic actor is stopped together with the machine.
  useEffect(() => () => audio.stopMusic(), []);

  useScreenKeys((k) => {
    const ev = KEY_EVENTS[k.length === 1 ? k.toLowerCase() : k];
    if (!ev) return false;
    send(ev);
    return true;
  });

  const step = snap.matches('speaker') ? 'speaker' : snap.matches('corners') ? 'corners' : 'mic';
  const n = step === 'speaker' ? 1 : step === 'corners' ? 2 : 3;
  const heard = snap.matches({ mic: { active: 'heard' } });
  const mood: MascotMood = step === 'speaker' ? 'dance' : step === 'corners' ? 'idle' : heard ? 'cheer' : 'shh';
  const { micError, level, cropped } = snap.context;
  const rowL = { justifyContent: 'flex-start' } as const;

  return (
    <section className="screen">
      <div className="screen-head">
        <div className="hero">
          <Mascot mood={mood} size="clamp(96px,10vw,140px)" />
          <div>
            <Eyebrow>Lần đầu lên lớp · kiểm tra nhanh {n}/3</Eyebrow>
            <h1>{TITLES[step]}</h1>
          </div>
        </div>
        <div className="head-actions">
          <Button kbd="Esc" onClick={() => send({ type: 'SKIP' })}>
            Bỏ qua
          </Button>
        </div>
      </div>

      <div className="panel check-panel">
        {step === 'speaker' && (
          <>
            <p className="note">Đang phát nhạc thử qua loa TV. Đứng cuối lớp nghe có rõ không?</p>
            <div className="row" style={rowL}>
              <Button primary big kbd="Enter" onClick={() => send({ type: 'NEXT' })}>
                Nghe rõ
              </Button>
              <Button big kbd="↑" onClick={() => send({ type: 'VOLUME_UP' })}>
                To hơn
              </Button>
              <Button big kbd="↓" onClick={() => send({ type: 'VOLUME_DOWN' })}>
                Nhỏ hơn
              </Button>
            </div>
          </>
        )}
        {step === 'corners' && (
          <>
            <p className="note">
              {cropped
                ? 'Đã bật lề an toàn TV. Nhìn lại lên TV: giờ thấy đủ 4 dấu góc đỏ chưa?'
                : 'Nhìn lên TV: 4 góc màn hình có 4 dấu góc màu đỏ. Nếu thiếu góc nào là TV đang cắt mép hình.'}
            </p>
            <div className="row" style={rowL}>
              <Button primary big kbd="Enter" onClick={() => send({ type: 'NEXT' })}>
                Thấy đủ 4 góc
              </Button>
              <Button big kbd="L" onClick={() => send({ type: 'CROPPED' })}>
                Bị cắt mép
              </Button>
            </div>
          </>
        )}
        {step === 'mic' && (
          <>
            {micError ? (
              <p className="note">{MIC_HELP[micError]}</p>
            ) : snap.matches({ mic: { active: 'opening' } }) ? (
              <p className="note">
                Trình duyệt sẽ hỏi quyền dùng micro → bấm <b>Cho phép</b>.
              </p>
            ) : (
              <p className="note">{heard ? 'Mic nghe rõ rồi! Bấm Enter để xong.' : 'Thầy/cô vỗ tay thử nhé. Thanh nhảy lên là mic nghe được.'}</p>
            )}
            <div className="meter" aria-label="Độ ồn">
              <div className="meter-fill" style={{ width: `${micError ? 0 : dbfsToPercent(level).toFixed(1)}%` }} />
            </div>
            <div className="row" style={rowL}>
              <Button primary big kbd="Enter" onClick={() => send({ type: 'NEXT' })}>
                Xong
              </Button>
              {micError && micError !== 'unsupported' && (
                <Button big onClick={() => send({ type: 'RETRY_MIC' })}>
                  Thử lại
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {step === 'corners' &&
        createPortal(
          <div className="corners" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>,
          document.body,
        )}
    </section>
  );
}
