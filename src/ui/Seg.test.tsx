import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Seg } from './Seg';

afterEach(cleanup);

const OPTIONS = [
  { value: 30, label: '30 giây' },
  { value: 60, label: '1 phút' },
  { value: 120, label: '2 phút' },
] as const;

describe('Seg', () => {
  it('marks only the selected option as pressed', () => {
    render(<Seg label="Thời gian" options={OPTIONS} value={60} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Thời gian' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 phút' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '30 giây' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the option value', () => {
    const onChange = vi.fn();
    render(<Seg options={OPTIONS} value={30} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '2 phút' }));
    expect(onChange).toHaveBeenCalledWith(120);
  });

  it('works as a controlled component', () => {
    function Harness() {
      const [v, setV] = useState<'de' | 'vua' | 'kho'>('vua');
      return (
        <Seg
          options={[
            { value: 'de', label: 'Dễ' },
            { value: 'vua', label: 'Vừa' },
            { value: 'kho', label: 'Khó' },
          ]}
          value={v}
          onChange={setV}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Khó' }));
    expect(screen.getByRole('button', { name: 'Khó' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Vừa' }).getAttribute('aria-pressed')).toBe('false');
  });
});
