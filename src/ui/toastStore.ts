import { create } from 'zustand';

/** How long a toast stays visible (mockup: 2600ms). */
export const TOAST_MS = 2600;

interface ToastState {
  message: string | null;
  /** Increments on every show so repeated identical messages restart the timer. */
  seq: number;
  show: (message: string) => void;
  hide: () => void;
}

/** Global toast store. In components: `const { show } = useToast(); show('Đã lưu')`. */
export const useToast = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));

/** Non-React access: `toast('Không có lớp "3Z"')`. */
export function toast(message: string): void {
  useToast.getState().show(message);
}
