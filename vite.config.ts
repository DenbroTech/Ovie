/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Stamped into the bundle so the UI can show which build is running.
    __OVIE_BUILD__: JSON.stringify(process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  server: { host: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
