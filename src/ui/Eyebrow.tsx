import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/** Small uppercase tag above a title, e.g. "Lớp 3A · Điểm danh". */
export function Eyebrow({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('eyebrow', className)} {...rest} />;
}
