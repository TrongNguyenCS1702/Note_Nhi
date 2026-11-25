import type { CSSProperties, ReactNode } from 'react';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore, type ScreenId } from '@/app/store';
import { useStudents, useTodaySession } from '@/db';
import { Button, Eyebrow, Mascot } from '@/ui';
import { BalloonIcon, ChairsIcon, ClockIcon } from './icons';

interface Game {
  key: string;
  to: ScreenId;
  title: string;
  text: string;
  color: string;
  rot: string;
  icon: ReactNode;
}

const GAMES: readonly Game[] = [
  {
    key: '1',
    to: 'chairs',
    title: 'Ghế âm nhạc',
    text: 'Nhạc dừng ở bạn nào thì bạn đó lên trả bài!',
    color: 'var(--sun)',
    rot: '-1deg',
    icon: <ChairsIcon />,
  },
  {
    key: '2',
    to: 'silence',
    title: 'Thử thách im lặng',
    text: 'Giữ yên đến hết giờ, ồn quá là bóng nổ đó!',
    color: 'var(--pink)',
    rot: '1deg',
    icon: <BalloonIcon />,
  },
  {
    key: '3',
    to: 'wait',
    title: 'Màn hình chờ',
    text: 'Đếm ngược kèm nhạc dân ca nhẹ nhàng.',
    color: 'var(--mint)',
    rot: '-.5deg',
    icon: <ClockIcon />,
  },
];

const SOON: ReadonlyArray<readonly [string, string]> = [
  ['Đoán bài hát', 'Nghe vài nốt đầu'],
  ['Đoán nhạc cụ', 'Nghe tiếng, hô tên'],
  ['Nhanh đứng, chậm ngồi', 'Cảm nhận tempo'],
  ['Gõ đệm theo', 'Vỗ tay theo tiết tấu'],
  ['Nốt nhạc rơi', 'Gọi trả bài kiểu mới'],
  ['Hộp quà bí ẩn', 'Phần thưởng cuối tiết'],
];

/** Lesson launcher (SPEC 3.3): 1–3 pick a game, D edits attendance, Esc changes class. */
export function LaunchScreen() {
  const classId = useAppStore((s) => s.classId);
  const classLabel = useAppStore((s) => s.classLabel);
  const go = useAppStore((s) => s.go);
  const students = useStudents(classId);
  const today = useTodaySession(classId);

  const total = students?.length ?? 0;
  const present = students?.filter((s) => !today?.absentIds.has(s.id)).length ?? 0;

  useScreenKeys((k) => {
    const game = GAMES.find((g) => g.key === k);
    if (game) {
      go(game.to);
      return true;
    }
    if (k === 'd' || k === 'D') {
      go('prep');
      return true;
    }
    if (k === 'Escape') {
      go('home');
      return true;
    }
  });

  return (
    <section className="screen" data-screen="launch">
      <div className="screen-head">
        <div className="hero">
          <Mascot mood="idle" size="clamp(96px,10vw,140px)" />
          <div>
            <Eyebrow>
              <b>{classLabel ?? ''}</b>
              {students && today ? ` · Có mặt ${present}/${total}` : ''}
            </Eyebrow>
            <h1>Chơi gì đây ta?</h1>
          </div>
        </div>
        <div className="head-actions">
          <Button kbd="D" onClick={() => go('prep')}>
            Sửa điểm danh
          </Button>
          <Button kbd="Esc" onClick={() => go('home')}>
            Đổi lớp
          </Button>
        </div>
      </div>
      <div className="games">
        {GAMES.map((g) => (
          <button
            key={g.key}
            type="button"
            className="game stk"
            style={{ '--c': g.color, '--rot': g.rot } as CSSProperties}
            onClick={() => go(g.to)}
          >
            <span className="num">{g.key}</span>
            <span className="ico">{g.icon}</span>
            <h2>{g.title}</h2>
            <p>{g.text}</p>
          </button>
        ))}
      </div>
      <span className="label">Sắp có ở bản sau</span>
      <div className="games soon">
        {SOON.map(([title, text]) => (
          <div key={title} className="game stk">
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
