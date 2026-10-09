/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// One id per build. The app compares it with /version.json to reload itself after a deploy.
const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function versionFile(): Plugin {
  return {
    name: 'ovie-version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: { host: true, port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely; keeping them separate lets devices reuse them across deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
});
