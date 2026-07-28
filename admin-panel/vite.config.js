import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deployed under /panel/ behind nginx. Assets are referenced relative to that base.
export default defineConfig({
  plugins: [react()],
  base: '/panel/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
