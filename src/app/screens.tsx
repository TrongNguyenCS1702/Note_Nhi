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
function Placeholder({ title, eyebrow, links = [] }: { title: string; eyebrow: string; links?: PlaceholderLink[] }) {
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

function HomePlaceholder() {
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

const ph = (title: string, eyebrow: string, links?: PlaceholderLink[]): ComponentType =>
  function PlaceholderScreen() {
    return <Placeholder title={title} eyebrow={eyebrow} links={links} />;
  };

/**
 * Screen registry: screen id → component. Feature teams replace their entry with the real screen
 * (e.g. `chairs: ChairsScreen` from `@/features/chairs`). Each screen renders a `<section className="screen">`.
 */
export const screens: Record<ScreenId, ComponentType> = {
  welcome: ph('Chào thầy/cô!', 'Lần đầu mở app', [{ to: 'home', label: 'Xong, vào app', kbd: 'Enter' }]),
  check: ph('Kiểm tra nhanh trên TV', 'Lần đầu lên lớp', [{ to: 'prep', label: 'Bỏ qua', kbd: 'Enter' }]),
  home: HomePlaceholder,
  prep: ph('Bạn nào vắng hôm nay?', 'Điểm danh', [{ to: 'launch', label: 'Vào tiết', kbd: 'Enter' }]),
  launch: ph('Chơi gì đây ta?', 'Chọn hoạt động', [
    { to: 'chairs', label: 'Ghế âm nhạc', kbd: '1' },
    { to: 'silence', label: 'Thử thách im lặng', kbd: '2' },
    { to: 'wait', label: 'Màn hình chờ', kbd: '3' },
    { to: 'prep', label: 'Sửa điểm danh', kbd: 'D' },
  ]),
  chairs: ph('Ghế âm nhạc', 'Đang làm'),
  silence: ph('Thử thách im lặng', 'Đang làm'),
  wait: ph('Màn hình chờ', 'Đang làm'),
  classes: ph('Quản lý lớp', 'Đang làm'),
  music: ph('Nhạc nền', 'Đang làm'),
  settings: ph('Cài đặt', 'Đang làm'),
};
