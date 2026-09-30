import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    // When VITE_API_URL isn't set, fall back to same-origin requests (served
    // through the dev proxy below). Without this the URL becomes the literal
    // string "undefined/api", the API calls hit the SPA fallback and return
    // HTML, and the pages crash on render -> blank screen.
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || '')
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:5000',
        '/uploads': 'http://localhost:5000'
      }
    }
  };
});
