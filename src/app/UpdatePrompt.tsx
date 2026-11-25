/// <reference types="vite-plugin-pwa/react" />
import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdatePill } from './UpdatePill';

/**
 * Service worker is in `prompt` mode: never reload mid-lesson. The update pill only shows on the
 * home screen (SPEC 3.10). Keep this mounted everywhere so registration happens once.
 * Note: `virtual:pwa-register/react` only exists under the Vite PWA plugin — tests mock this module.
 */
export function UpdatePrompt({ visible }: { visible: boolean }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  return <UpdatePill visible={visible} needRefresh={needRefresh} onUpdate={() => void updateServiceWorker(true)} />;
}
