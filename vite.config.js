import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the build can be hosted from any sub-path (Vercel,
  // GitHub Pages, a plain file server, ...).
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
