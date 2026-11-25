import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the dialog. */
  label?: string;
}

/** Fixed scrim that centers its children (usually a `Card`). Keys are handled by the screen via useScreenKeys. */
export function Overlay({ className, label, ...rest }: OverlayProps) {
  return <div role="dialog" aria-modal="true" aria-label={label} className={cx('overlay', className)} {...rest} />;
}

/** Pop-in sticker card (mockup `.card`). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card', className)} {...rest} />;
}
