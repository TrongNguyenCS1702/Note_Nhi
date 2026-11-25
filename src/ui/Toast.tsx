import { useEffect } from 'react';
import { TOAST_MS, useToast } from './toastStore';

/** Host for the global toast; render once in the app shell. */
export function Toast() {
  const message = useToast((s) => s.message);
  const seq = useToast((s) => s.seq);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (message == null) return;
    const t = setTimeout(hide, TOAST_MS);
    return () => clearTimeout(t);
  }, [message, seq, hide]);

  return (
    <div className="toast" role="status" hidden={message == null}>
      {message}
    </div>
  );
}
