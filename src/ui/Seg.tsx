import { cx } from './cx';

export interface SegOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SegProps<T extends string | number> {
  options: ReadonlyArray<SegOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible group name, e.g. "Thời gian". */
  label?: string;
  className?: string;
}

/** Segmented control: one pressed button (aria-pressed) per group. */
export function Seg<T extends string | number>({ options, value, onChange, label, className }: SegProps<T>) {
  return (
    <div className={cx('seg', className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
