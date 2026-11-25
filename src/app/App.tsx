import { useEffect } from 'react';
import { BgNotes } from '@/ui/BgNotes';
import { Confetti } from '@/ui/Confetti';
import { Toast } from '@/ui/Toast';
import { AppBar } from './AppBar';
import { ErrorBoundary, type ErrorReporter } from './ErrorBoundary';
import { installKeyboard } from './keyboard';
import { screens } from './screens';
import { isTypingScreen, useAppStore } from './store';
import { UpdatePrompt } from './UpdatePrompt';
import { useWakeLock } from './wakeLock';

export interface AppProps {
  /** Error sink for the screen ErrorBoundary (wire to the local error log). */
  onError?: ErrorReporter;
}

export function App({ onError }: AppProps) {
  const screen = useAppStore((s) => s.screen);
  const go = useAppStore((s) => s.go);
  const safeMargin = useAppStore((s) => s.safeMargin);

  useEffect(() => installKeyboard(), []);
  useWakeLock(!isTypingScreen(screen));
  useEffect(() => {
    document.body.classList.toggle('safe', safeMargin);
  }, [safeMargin]);

  const Screen = screens[screen];

  return (
    <>
      <BgNotes />
      <AppBar />
      <main>
        <ErrorBoundary resetKey={screen} onError={onError} onHome={() => go('home')}>
          <Screen key={screen} />
        </ErrorBoundary>
      </main>
      <Toast />
      <Confetti />
      <UpdatePrompt visible={screen === 'home'} />
    </>
  );
}
