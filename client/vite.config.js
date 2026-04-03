import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ultimate-snake-game/',
  build: {
    outDir: 'dist',
  },
  server: {
    host: true,
  }
});
