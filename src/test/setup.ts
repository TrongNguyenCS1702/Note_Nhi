import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';

// Use the global `afterEach` (vitest `globals: true`) instead of importing from 'vitest':
// on Windows a lower-case drive letter in the cwd (VS Code opens `d:\…`) makes Vite load
// vitest twice, and an imported hook then can't find the running suite.
afterEach(() => cleanup());
