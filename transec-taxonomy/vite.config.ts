import { defineConfig } from 'vite';

// base './' so the built site works from any static path (GitHub Pages, file server)
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
  },
});
