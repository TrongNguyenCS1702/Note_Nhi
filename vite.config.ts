import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // SPEC 3.10: never reload mid-lesson; the app shows "Có bản mới" on the home screen only
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Note Nhí',
        short_name: 'Note Nhí',
        lang: 'vi',
        description: 'Trò chơi cho tiết Âm nhạc tiểu học: ghế âm nhạc, thử thách im lặng, màn hình chờ.',
        theme_color: '#ffd95a',
        background_color: '#e8f4ff',
        display: 'standalone',
        start_url: '.',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,woff}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
    }),
  ],
});
