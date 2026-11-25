import {
  Fragment,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cx, stickerColor } from './cx';
import { fitNameCells } from './fitNames';

export interface NameCell {
  id: string;
  /** Display name (one line; auto-shrinks to fit). */
  label: string;
  /** State classes: `absent`, `called`, `hot`, `picked`, `out`, `t1`–`t3`, `flash`, `bump`, `grabbed`, `wobble`. */
  className?: string;
  /** Sticker color as a CSS value (`var(--sun)`); defaults to the palette cycle by `colorIndex`. */
  color?: string;
  /** Palette index; defaults to the item's position. Keep it stable per student so colors don't jump. */
  colorIndex?: number;
  title?: string;
  /** For button cells: aria-pressed (e.g. absent toggle on Điểm danh). */
  pressed?: boolean;
}

export interface NameGridHandle {
  /** Grid root (`.names`). */
  readonly root: HTMLDivElement | null;
  /** Cell element by item id — for animations (rider/spotlight/claw positioning, class toggles). */
  getCell(id: string): HTMLElement | null;
  /** All mounted cells keyed by item id. */
  cells(): ReadonlyMap<string, HTMLElement>;
  /** Re-run the one-line fit (e.g. after editing a name). */
  fit(): void;
}

export interface NameGridProps {
  items: readonly NameCell[];
  /** Use `prep-grid` or `chair-grid` to get the 1366×768 40-cell fit rules and chairs effects CSS. */
  id?: string;
  /** Extra classes on `.names`, e.g. `focus`. */
  className?: string;
  /** Cells as buttons (clickable) or plain divs. Default: `button` when a click handler is given. */
  as?: 'button' | 'div';
  onCellClick?: (id: string, e: MouseEvent<HTMLElement>) => void;
  onCellDoubleClick?: (id: string, e: MouseEvent<HTMLElement>) => void;
  /** Replace a cell's rendering (e.g. inline name editor). Return `undefined` to use the default sticker. */
  renderCell?: (item: NameCell, index: number) => ReactNode | undefined;
  ref?: Ref<NameGridHandle>;
}

/** Grid of name stickers (mockup `.names` + `.name.stk`). */
export function NameGrid({ items, id, className, as, onCellClick, onCellDoubleClick, renderCell, ref }: NameGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cellMap = useRef(new Map<string, HTMLElement>());
  const Tag = as ?? (onCellClick || onCellDoubleClick ? 'button' : 'div');

  const fit = useCallback(() => {
    const root = rootRef.current;
    if (root) fitNameCells(root);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      get root() {
        return rootRef.current;
      },
      getCell: (cellId) => cellMap.current.get(cellId) ?? null,
      cells: () => cellMap.current,
      fit,
    }),
    [fit],
  );

  // refit whenever names change, on resize, and once web fonts are ready
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [items, fit]);
  useLayoutEffect(() => {
    let alive = true;
    const onResize = () => fit();
    addEventListener('resize', onResize);
    void document.fonts?.ready.then(() => alive && fit());
    return () => {
      alive = false;
      removeEventListener('resize', onResize);
    };
  }, [fit]);

  return (
    <div className={cx('names', className)} id={id} ref={rootRef}>
      {items.map((item, i) => {
        const custom = renderCell?.(item, i);
        if (custom !== undefined) return <Fragment key={item.id}>{custom}</Fragment>;
        const style = { '--c': item.color ?? stickerColor(item.colorIndex ?? i) } as CSSProperties;
        const setRef = (el: HTMLElement | null) => {
          if (el) cellMap.current.set(item.id, el);
          else cellMap.current.delete(item.id);
        };
        return (
          <Tag
            key={item.id}
            ref={setRef}
            className={cx('name stk', item.className)}
            style={style}
            data-id={item.id}
            title={item.title}
            {...(Tag === 'button' ? { type: 'button' as const, 'aria-pressed': item.pressed } : {})}
            onClick={onCellClick && ((e: MouseEvent<HTMLElement>) => onCellClick(item.id, e))}
            onDoubleClick={onCellDoubleClick && ((e: MouseEvent<HTMLElement>) => onCellDoubleClick(item.id, e))}
          >
            {item.label}
          </Tag>
        );
      })}
    </div>
  );
}
