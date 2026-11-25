import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { App } from '@/app/App';
import { bootstrap } from '@/app/bootstrap';
import { useAppStore } from '@/app/store';
import { logError } from '@/db';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

void bootstrap();
createRoot(root).render(
  <StrictMode>
    <App
      onError={(error) => {
        const e = error instanceof Error ? error : new Error(String(error));
        void logError({ screen: useAppStore.getState().screen, message: e.message, stack: e.stack });
      }}
    />
  </StrictMode>,
);
