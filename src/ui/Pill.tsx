import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  sun?: boolean;
}

/** Rounded label, e.g. "Có mặt 38/40". */
export function Pill({ sun, className, ...rest }: PillProps) {
  return <span className={cx('pill', sun && 'sun', className)} {...rest} />;
}
