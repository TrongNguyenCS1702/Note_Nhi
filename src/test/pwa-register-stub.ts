// Vitest stub for the `virtual:pwa-register/react` module (only exists in Vite builds).
export function useRegisterSW() {
  return { needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} } as const;
}
