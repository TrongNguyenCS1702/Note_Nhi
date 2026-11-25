import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { canWipe, SettingsScreen } from '.';

describe('settings wipe guard', () => {
  it('only accepts the exact word', () => {
    expect(canWipe('XOA')).toBe(true);
    expect(canWipe('xoa')).toBe(false);
    expect(canWipe('')).toBe(false);
  });

  it('keeps the wipe button disabled until XOA is typed', () => {
    render(<SettingsScreen />);
    const btn = screen.getByRole('button', { name: 'Xoá hết' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Gõ XOA để xác nhận'), { target: { value: 'XOA' } });
    expect(btn.disabled).toBe(false);
  });
});
