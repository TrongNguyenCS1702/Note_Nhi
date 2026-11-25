# Lớp Nhạc Vui 🎵

An **offline-first PWA** that makes primary-school music lessons more fun. Runs on the teacher's laptop, projected to the classroom TV, driven by the keyboard.

- 🪑 **Musical chairs picker**: fair student picker (never picks absent students, no repeats within 7 days) with 4 animated reveal styles
- 🎈 **Silence challenge**: the laptop mic measures classroom noise (dBFS, AGC disabled); a balloon pops if the class gets too loud
- ⏳ **Transition countdown** with calm folk music
- 📋 21 classes / ~840 students, Excel import, attendance in seconds

## Why no backend?
Student names are personal data of children, and classrooms have unreliable Wi-Fi. Everything stays on the teacher's laptop (IndexedDB), with automatic backups to a folder of their choice. The data model (UUID v7, `ownerId`, soft deletes, flat tables, Zod schemas) is designed so a sync backend can be added later without a migration. See `docs/SPEC_v1.md` §5.

## Stack
React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · XState v5 · Zustand · Dexie · Web Audio API · vite-plugin-pwa · Vitest + fast-check · Playwright · GitHub Actions

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + lint + unit tests
npm run e2e      # Playwright at 1366×768 and 1920×1080
```

Docs: product spec (Vietnamese) in `docs/SPEC_v1.md`, approved interactive mockup in `mockup/`.
