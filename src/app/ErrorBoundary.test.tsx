import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(cleanup);

function Boom({ explode }: { explode: boolean }): React.ReactNode {
  if (explode) throw new Error('kaboom');
  return <p>ổn rồi</p>;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('ổn rồi')).toBeTruthy();
  });

  it('shows the sticker fallback, reports the error and offers home/reload', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    const onReload = vi.fn();
    render(
      <ErrorBoundary onError={onError} onReload={onReload}>
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Ối, có lỗi nhỏ')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('kaboom');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(onReload).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it('"Về trang chủ" calls onHome and recovers once the child stops throwing', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Harness() {
      const [explode, setExplode] = useState(true);
      return (
        <ErrorBoundary onError={() => {}} onHome={() => setExplode(false)}>
          <Boom explode={explode} />
        </ErrorBoundary>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Về trang chủ/ }));
    expect(screen.getByText('ổn rồi')).toBeTruthy();
    consoleErr.mockRestore();
  });

  it('resets when resetKey changes', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary onError={() => {}} resetKey="chairs">
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    rerender(
      <ErrorBoundary onError={() => {}} resetKey="home">
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('ổn rồi')).toBeTruthy();
    consoleErr.mockRestore();
  });
});
