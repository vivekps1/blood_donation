import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const root = (globalThis as any)?.process?.cwd?.() || '.';
  const env = loadEnv(mode, root, ''); // load all envs, no prefix filter
  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['lucide-react'],
    },
    define: {
      'import.meta.env.ADMIN_EMAIL': JSON.stringify(env.ADMIN_EMAIL || ''),
    },
  };
});
