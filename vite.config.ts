import { defineConfig } from 'vitest/config';

// `base` is overridable so the same build works on GitHub Pages
// (https://<user>.github.io/safeshare-json/) and on any other static host.
export default defineConfig({
  base: process.env.SAFESHARE_BASE ?? '/safeshare-json/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    // The modulepreload polyfill injects a `fetch` call. The app must ship
    // zero network primitives, so it is disabled on purpose.
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
