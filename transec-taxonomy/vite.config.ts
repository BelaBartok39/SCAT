import { defineConfig } from 'vite';

// base './' so the built site works from any static path (GitHub Pages, file server)
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // three.js is by far the largest dependency; isolating it lets the
        // app shell iterate without invalidating the cached vendor chunk.
        manualChunks: { three: ['three'] },
      },
    },
  },
});
