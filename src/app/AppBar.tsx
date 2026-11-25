import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';
import { Pill } from '@/ui/Pill';
import { toggleFullscreenLoud } from './fullscreen';
import { isTypingScreen, useAppStore } from './store';

export interface AppBarProps {
  /** Override the class pill text; defaults to the store's `classLabel`. */
  classLabel?: string | null;
}

/** Top bar on every screen: brand · class pill (hidden on home/welcome) · mute (M) · fullscreen (F). */
export function AppBar({ classLabel }: AppBarProps) {
  const screen = useAppStore((s) => s.screen);
  const storeLabel = useAppStore((s) => s.classLabel);
  const muted = useAppStore((s) => s.muted);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const label = classLabel === undefined ? storeLabel : classLabel;

  return (
    <header className="appbar">
      <div className="brand" role="heading" aria-level={1}>
        <Mascot className="dot" mood="idle" size={42} />
        <span>
          Lớp Nhạc <em>Vui</em>
        </span>
      </div>
      <div className="appbar-right">
        {label && !isTypingScreen(screen) && <Pill sun>{label}</Pill>}
        <Button kbd="M" onClick={toggleMute}>
          Tiếng: {muted ? 'tắt' : 'bật'}
        </Button>
        <Button kbd="F" onClick={() => void toggleFullscreenLoud()}>
          Toàn màn hình
        </Button>
      </div>
    </header>
  );
}
