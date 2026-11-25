import type { ReactNode } from 'react';
import { cx } from './cx';
import { Kbd } from './Kbd';

export interface HintProps {
  /** One key or several keys shown before the text. */
  k?: string | readonly string[];
  children?: ReactNode;
}

/** One hint: `<Hint k="Space">chạy nhạc</Hint>` → `<span><span class="kbd">Space</span> chạy nhạc</span>`. */
export function Hint({ k, children }: HintProps) {
  const keys = k == null ? [] : typeof k === 'string' ? [k] : k;
  return (
    <span>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      {children}
    </span>
  );
}

/** Row of keyboard hints under a screen. */
export function HintBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('hintbar', className)}>{children}</div>;
}
