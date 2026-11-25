import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitNameCells } from './fitNames';
import { NameGrid, type NameGridHandle } from './NameGrid';

afterEach(cleanup);

const ITEMS = [
  { id: 'a', label: 'An' },
  { id: 'b', label: 'Bảo', className: 'absent', pressed: true },
  { id: 'c', label: 'Khánh Linh', className: 'called', colorIndex: 4 },
];

describe('NameGrid', () => {
  it('renders sticker cells with state classes and palette colors', () => {
    const { container } = render(<NameGrid id="prep-grid" items={ITEMS} />);
    const root = container.querySelector('#prep-grid');
    expect(root?.classList.contains('names')).toBe(true);
    const cells = container.querySelectorAll<HTMLElement>('.name.stk');
    expect(cells).toHaveLength(3);
    expect(cells[1]?.classList.contains('absent')).toBe(true);
    expect(cells[0]?.style.getPropertyValue('--c')).toBe('var(--pink)');
    expect(cells[2]?.style.getPropertyValue('--c')).toBe('var(--orange)');
    expect(cells[0]?.tagName).toBe('DIV');
  });

  it('uses buttons with aria-pressed when clickable and reports the cell id', () => {
    const onClick = vi.fn();
    render(<NameGrid items={ITEMS} onCellClick={onClick} />);
    const bao = screen.getByRole('button', { name: 'Bảo' });
    expect(bao.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(bao);
    expect(onClick).toHaveBeenCalledWith('b', expect.anything());
  });

  it('exposes cell elements by id through the ref handle', () => {
    const ref = createRef<NameGridHandle>();
    render(<NameGrid ref={ref} items={ITEMS} />);
    expect(ref.current?.getCell('c')?.textContent).toBe('Khánh Linh');
    expect(ref.current?.getCell('zzz')).toBeNull();
    expect(ref.current?.cells().size).toBe(3);
    expect(ref.current?.root?.classList.contains('names')).toBe(true);
  });

  it('fitNameCells shrinks overflowing names down to the minimum', () => {
    const root = document.createElement('div');
    const el = document.createElement('div');
    el.className = 'name';
    el.style.fontSize = '30px';
    root.appendChild(el);
    document.body.appendChild(root);
    // fake layout: text is 10px wider than the cell per px of font size above 20
    Object.defineProperty(el, 'clientWidth', { get: () => 100 });
    Object.defineProperty(el, 'scrollWidth', {
      get: () => 100 + Math.max(0, parseFloat(el.style.fontSize || '30') - 20) * 10,
    });
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fontSize: '30px' } as CSSStyleDeclaration);
    fitNameCells(root);
    expect(el.style.fontSize).toBe('20px');
    spy.mockRestore();
    root.remove();
  });
});
