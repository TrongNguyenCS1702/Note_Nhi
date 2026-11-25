import { useMemo, useState, type CSSProperties } from 'react';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore } from '@/app/store';
import { useClassesByGrade, useRecentClasses, useSuggestedClass, type ClassWithCount } from '@/db';
import { normalizeClassName, type Grade } from '@/domain';
import { Button, Eyebrow, Kbd, Mascot, toast } from '@/ui';
import { formatClock, openClassFlow, type ClassRef } from './openClassFlow';

/** Grade colors (SPEC 3.0): 1 pink, 2 orange, 3 sun, 4 mint, 5 sky. */
const GRADE_COLORS: Readonly<Record<Grade, string>> = {
  1: 'var(--pink)',
  2: 'var(--orange)',
  3: 'var(--sun)',
  4: 'var(--mint)',
  5: 'var(--sky)',
};

export const gradeColor = (g: number): string => GRADE_COLORS[g as Grade] ?? 'var(--paper)';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Thứ Tư, 25/11" */
export function todayLabel(now: number): string {
  return cap(new Date(now).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' }));
}

const weekdayLabel = (now: number) => cap(new Date(now).toLocaleDateString('vi-VN', { weekday: 'long' }));

function minuteClock(min: number): string {
  const d = new Date(0);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return formatClock(d.getTime());
}

const rot = (i: number) => ({ '--rot': `${(((i * 3) % 5) - 2) * 0.7}deg` }) as CSSProperties;
const colorVar = (c: string) => ({ '--c': c }) as CSSProperties;

export function HomeScreen() {
  const [now] = useState(() => Date.now());
  const [typed, setTyped] = useState('');
  const go = useAppStore((s) => s.go);
  const grades = useClassesByGrade();
  const recent = useRecentClasses(3);
  const suggestion = useSuggestedClass(now);

  const byId = useMemo(() => {
    const m = new Map<string, ClassWithCount>();
    for (const g of grades ?? []) for (const c of g.classes) m.set(c.id, c);
    return m;
  }, [grades]);
  const suggested = suggestion ? byId.get(suggestion.classId) : undefined;

  const open = (c: ClassRef) => {
    setTyped('');
    void openClassFlow(c);
  };

  useScreenKeys((k) => {
    if (/^[0-9a-zA-Z]$/.test(k)) {
      setTyped((t) => (t + k).slice(-2).toUpperCase());
      return true;
    }
    if (k === 'Backspace') {
      setTyped((t) => t.slice(0, -1));
      return true;
    }
    if (k === 'Escape') {
      setTyped('');
      return true;
    }
    if (k === 'Enter') {
      if (!typed) {
        if (suggested) open(suggested);
        return true;
      }
      const name = normalizeClassName(typed);
      const found = [...byId.values()].find((c) => c.name === name);
      if (found) open(found);
      else toast(`Không có lớp "${typed}"`);
      return true;
    }
  });

  const reason =
    suggestion?.reason === 'timetable'
      ? `${weekdayLabel(now)}${suggestion.startMin != null ? ` · ${minuteClock(suggestion.startMin)}` : ''} · theo thời khoá biểu`
      : `${weekdayLabel(now)} · theo các tuần trước`;

  return (
    <section className="screen" data-screen="home">
      <div className="screen-head">
        <div className="hero">
          <Mascot mood="wave" size="clamp(110px,12vw,170px)" />
          <div>
            <Eyebrow>{todayLabel(now)}</Eyebrow>
            <h1>
              Hôm nay mình
              <br />
              vào lớp nào nhỉ?
            </h1>
          </div>
        </div>
        <div className="typebox">
          <span>Hoặc gõ tên lớp</span>
          <output aria-live="polite" aria-label="Tên lớp đang gõ">
            {typed || '__'}
          </output>
          <Kbd>Enter</Kbd>
        </div>
      </div>

      {suggested && (
        <div style={{ display: 'flex' }}>
          <button
            type="button"
            className="suggest stk"
            style={colorVar(gradeColor(suggested.grade))}
            onClick={() => open(suggested)}
            aria-label={`Vào lớp gợi ý ${suggested.name}`}
          >
            <strong>{suggested.name}</strong>
            <span className="sg">
              <span className="sg-l">Gợi ý cho giờ này</span>
              <small>{reason}</small>
            </span>
            <Kbd>Enter</Kbd>
          </button>
        </div>
      )}

      {recent && recent.length > 0 && (
        <div className="recent">
          <span className="label">Lớp vừa dạy</span>
          <div className="chips">
            {recent.map((c) => (
              <button key={c.id} type="button" className="chip stk" style={colorVar(gradeColor(c.grade))} onClick={() => open(c)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grades">
        {(grades ?? [])
          .filter((g) => g.classes.length > 0)
          .map((g) => (
            <div className="grade-row" key={g.grade}>
              <span className="grade-tag stk" style={colorVar(gradeColor(g.grade))}>
                Khối {g.grade}
              </span>
              <div className="grade-btns">
                {g.classes.map((c, i) => (
                  <button key={c.id} type="button" className="cls-btn stk" style={rot(i)} onClick={() => open(c)}>
                    <strong>{c.name}</strong>
                    <small>{c.studentCount} bạn</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="home-foot">
        <Button onClick={() => go('classes')}>Quản lý lớp</Button>
        <Button onClick={() => go('music')}>Nhạc nền</Button>
        <Button onClick={() => go('settings')}>Cài đặt</Button>
      </div>
    </section>
  );
}
