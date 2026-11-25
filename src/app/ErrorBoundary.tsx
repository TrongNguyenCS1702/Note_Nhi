import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';

export type ErrorReporter = (error: unknown, info: ErrorInfo) => void;

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Where to report (e.g. the local error log in db/). Defaults to console.error. */
  onError?: ErrorReporter;
  /** "Về trang chủ": navigate home; the boundary resets itself. */
  onHome?: () => void;
  /** "Tải lại": defaults to `location.reload()`. */
  onReload?: () => void;
  /** Changing this (e.g. the current screen id) clears the error. */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
}

const defaultReporter: ErrorReporter = (error, info) => console.error('[ErrorBoundary]', error, info.componentStack);

/** Sticker-style fallback so the TV never shows a blank page (SPEC 3.10). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    try {
      (this.props.onError ?? defaultReporter)(error, info);
    } catch {
      // reporting must never break the fallback
    }
  }

  override componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.setState({ hasError: false });
  }

  private home = () => {
    this.props.onHome?.();
    this.setState({ hasError: false });
  };

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="screen" role="alert">
        <div className="card">
          <Mascot mood="sad" size={120} />
          <p className="big-title">Ối, có lỗi nhỏ</p>
          <p className="result-sub">Dữ liệu vẫn được lưu. Thầy/cô bấm Về trang chủ hoặc Tải lại nhé.</p>
          <div className="row">
            {/* autofocus so Enter works from the keyboard */}
            <Button primary big kbd="Enter" onClick={this.home} autoFocus>
              Về trang chủ
            </Button>
            <Button big onClick={this.reload}>
              Tải lại
            </Button>
          </div>
        </div>
      </section>
    );
  }
}
