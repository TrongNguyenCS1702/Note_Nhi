import type { ReactNode } from 'react';

/** Keycap hint, e.g. `<Kbd>Space</Kbd>`. */
export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}
