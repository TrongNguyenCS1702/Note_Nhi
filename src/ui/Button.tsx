import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Kbd } from './Kbd';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Sun-yellow main action. */
  primary?: boolean;
  /** Large display-font button (mockup `.btn.big`). */
  big?: boolean;
  /** Keyboard hint rendered after the label, e.g. `"Space"`. */
  kbd?: ReactNode;
}

/** Mockup `.btn`. Defaults to `type="button"`. */
export function Button({ primary, big, kbd, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx('btn', primary && 'primary', big && 'big', className)} {...rest}>
      {children}
      {kbd != null && <Kbd>{kbd}</Kbd>}
    </button>
  );
}
