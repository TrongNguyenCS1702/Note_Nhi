import type { ComponentType } from 'react';
import { Button } from '@/ui/Button';
import { Eyebrow } from '@/ui/Eyebrow';
import { HintBar, Hint } from '@/ui/HintBar';
import { enterFullscreen } from './fullscreen';
import { useScreenKeys } from './keyboard';
import { useAppStore, type ScreenId } from './store';

interface PlaceholderLink {
  to: ScreenId;
  label: string;
  /** Key that triggers this link (also shown as a kbd hint). */
  kbd?: string;
}

/** Temporary screen until the feature team ships the real one. */
export function Placeholder({ title, eyebrow, links = [] }: { title: string; eyebrow: string; links?: PlaceholderLink[] }) {
  const go = useAppStore((s) => s.go);
  useScreenKeys((k) => {
    const link = links.find((l) => l.kbd && l.kbd.toLowerCase() === k.toLowerCase());
    if (!link) return false;
    go(link.to);
    return true;
  });
  return (
    <section className="screen">
      <div className="screen-head">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1>{title}</h1>
        </div>
      </div>
      {links.length > 0 && (
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          {links.map((l) => (
            <Button key={l.to} big kbd={l.kbd} onClick={() => go(l.to)}>
              {l.label}
            </Button>
          ))}
        </div>
      )}
      <HintBar>
        <Hint k="Esc">quay lại</Hint>
        <Hint k="F">toàn màn hình</Hint>
        <Hint k="M">tắt tiếng</Hint>
      </HintBar>
    </section>
  );
}

export function HomePlaceholder() {
  const openClass = useAppStore((s) => s.openClass);
  const go = useAppStore((s) => s.go);
  const open = () => {
    void enterFullscreen(); // inside the gesture, before navigation
    openClass('3A');
  };
  useScreenKeys((k) => {
    if (k === 'Enter') {
      open();
      return true;
    }
  });
  return (
    <section className="screen">
      <div className="screen-head">
        <div>
          <Eyebrow>Trang chủ</Eyebrow>
          <h1>
            Hôm nay mình
            <br />
            vào lớp nào nhỉ?
          </h1>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <Button primary big kbd="Enter" onClick={open}>
          Vào lớp 3A
        </Button>
      </div>
      <div className="home-foot">
        <Button onClick={() => go('classes')}>Quản lý lớp</Button>
        <Button onClick={() => go('music')}>Nhạc nền</Button>
        <Button onClick={() => go('settings')}>Cài đặt</Button>
      </div>
    </section>
  );
}

export const ph = (title: string, eyebrow: string, links?: PlaceholderLink[]): ComponentType =>
  function PlaceholderScreen() {
    return <Placeholder title={title} eyebrow={eyebrow} links={links} />;
  };

