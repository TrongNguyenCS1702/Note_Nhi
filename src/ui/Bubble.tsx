import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/** Mascot speech bubble (tail on the left; inside `.mascot-col` the tail points down). */
export function Bubble({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('bubble', className)} {...rest} />;
}
