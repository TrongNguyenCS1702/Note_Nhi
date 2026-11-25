import type { MicErrorKind } from '@/audio/types';
import { Button, Card, cssVars, Eyebrow, Mascot, Overlay } from '@/ui';

const POP_OPTIONS = [
  { n: 1, c: 'var(--mint)', title: 'Chơi lại', sub: 'Cùng thời gian, cùng độ khó' },
  { n: 2, c: 'var(--orange)', title: 'Chơi lại, khó hơn', sub: 'Lâu hơn và ngưỡng thấp hơn' },
  { n: 3, c: 'var(--lilac)', title: 'Thử thách vui', sub: 'Quay 1 thử thách cho cả lớp' },
  { n: 4, c: 'var(--sky)', title: 'Cho qua', sub: 'Về màn hình chọn hoạt động' },
] as const;

export interface PopOverlayProps {
  /** null = the 4 options; string = the fun challenge card. */
  challenge: string | null;
  onOption: (n: number) => void;
}

/** Balloon popped: 4 options, or the rolled fun challenge (mockup #sil-pop). */
export function PopOverlay({ challenge, onOption }: PopOverlayProps) {
  return (
    <Overlay label="Bóng nổ rồi">
      {challenge == null ? (
        <Card>
          <Mascot mood="sad" size={120} />
          <p className="big-title">Ôi, bóng nổ rồi!</p>
          <p className="result-sub">Thầy/cô chọn tiếp theo làm gì nè</p>
          <div className="options">
            {POP_OPTIONS.map((o) => (
              <button key={o.n} type="button" className="opt stk" style={cssVars({ '--c': o.c })} onClick={() => onOption(o.n)}>
                <span className="k">{o.n}</span>
                <span>
                  <strong>{o.title}</strong>
                  <small>{o.sub}</small>
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <Eyebrow>Thử thách cho cả lớp</Eyebrow>
          <p className="challenge" aria-live="polite">
            {challenge}
          </p>
          <div className="row">
            <Button primary big kbd="1" onClick={() => onOption(1)}>
              Xong, chơi lại
            </Button>
            <Button big kbd="4" onClick={() => onOption(4)}>
              Cho qua
            </Button>
          </div>
        </Card>
      )}
    </Overlay>
  );
}

export function WinOverlay({ onAgain, onLeave }: { onAgain: () => void; onLeave: () => void }) {
  return (
    <Overlay label="Cả lớp giỏi quá">
      <Card>
        <Mascot mood="cheer" size={150} />
        <p className="big-title">Cả lớp giỏi quá!</p>
        <p className="result-sub">Bóng vẫn còn nguyên, lớp mình im lặng siêu đỉnh</p>
        <div className="row">
          <Button primary big kbd="Space" onClick={onAgain}>
            Chơi tiếp
          </Button>
          <Button big kbd="Esc" onClick={onLeave}>
            Về
          </Button>
        </div>
      </Card>
    </Overlay>
  );
}

const MIC_ERROR_TEXT: Record<MicErrorKind, { title: string; sub: string; retry: string }> = {
  denied: {
    title: 'Chưa được dùng micro',
    sub: 'Trình duyệt đang chặn micro nên app chưa nghe được lớp mình.',
    retry: 'Thử lại',
  },
  'no-device': {
    title: 'Không tìm thấy micro',
    sub: 'Laptop chưa có micro nào hoạt động. Thầy/cô cắm micro (hoặc bật micro của laptop) rồi bấm Thử lại.',
    retry: 'Thử lại',
  },
  ended: {
    title: 'Micro vừa bị ngắt',
    sub: 'Trò chơi đang tạm dừng, mạng và thời gian vẫn giữ nguyên. Cắm lại micro rồi bấm Chơi tiếp.',
    retry: 'Chơi tiếp',
  },
  unsupported: {
    title: 'Trình duyệt chưa hỗ trợ micro',
    sub: 'Thầy/cô mở app bằng Chrome hoặc Edge bản mới rồi thử lại nhé.',
    retry: 'Thử lại',
  },
};

/** Mic denied / missing / unplugged mid-game (SPEC 3.5 "Xử lý lỗi"). */
export function MicErrorOverlay({ kind, onRetry, onBack }: { kind: MicErrorKind; onRetry: () => void; onBack: () => void }) {
  const t = MIC_ERROR_TEXT[kind];
  return (
    <Overlay label={t.title}>
      <Card className="max-w-[860px]">
        <Mascot mood="sad" size={120} />
        <p className="text-[clamp(36px,4.4vw,64px)] leading-none font-extrabold" style={{ fontFamily: 'var(--f-display)' }}>
          {t.title}
        </p>
        <p className="result-sub">{t.sub}</p>
        {kind === 'denied' && (
          <ol className="stk flex flex-col gap-3 px-7 py-5 text-left text-[clamp(20px,2vw,28px)] font-extrabold" style={cssVars({ '--c': 'var(--sun)' })}>
            <li>
              1. Bấm vào biểu tượng <span aria-hidden="true">🔒</span> ở đầu thanh địa chỉ (bên trái chữ đường link).
            </li>
            <li>2. Tìm dòng “Micro” rồi chọn “Cho phép”.</li>
            <li>3. Quay lại đây và bấm “Thử lại”.</li>
          </ol>
        )}
        <div className="row">
          <Button primary big kbd="Space" onClick={onRetry}>
            {t.retry}
          </Button>
          <Button big kbd="Esc" onClick={onBack}>
            Về
          </Button>
        </div>
      </Card>
    </Overlay>
  );
}
