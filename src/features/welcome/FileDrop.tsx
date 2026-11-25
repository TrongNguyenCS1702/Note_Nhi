import { useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { cx } from '@/ui';

export interface FileDropProps {
  /** `accept` of the file input, e.g. ".zip". */
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Big dashed drop zone (mockup `.drop.stk`): drop files on it or click to pick. */
export function FileDrop({ accept, multiple, onFiles, children, className, style, disabled, ...rest }: FileDropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    if (disabled) return;
    const files = [...e.dataTransfer.files];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <>
      <button
        type="button"
        className={cx('drop stk', className)}
        style={over ? { ...style, '--c': 'var(--sun)' } as CSSProperties : style}
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-label={rest['aria-label']}
      >
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
