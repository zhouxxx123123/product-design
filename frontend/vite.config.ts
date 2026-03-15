import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:4001';
  const aiTarget = env.VITE_AI_URL || 'http://localhost:8000';

  function makeProxyLogger(prefix: string) {
    return (proxy: import('http-proxy').Server) => {
      proxy.on('proxyReq', (_proxyReq, req) => {
        console.log(`\x1b[36m[proxy → ${prefix}]\x1b[0m ${req.method} ${req.url}`);
      });
      proxy.on('proxyRes', (proxyRes, req) => {
        const color = (proxyRes.statusCode ?? 0) >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(`${color}[proxy ← ${prefix}]\x1b[0m ${proxyRes.statusCode} ${req.url}`);
      });
      proxy.on('error', (err, req) => {
        console.error(`\x1b[31m[proxy ERR ${prefix}]\x1b[0m ${(req as { url?: string }).url} — ${err.message}`);
      });
    };
  }

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@services': path.resolve(__dirname, './src/services'),
      '@views': path.resolve(__dirname, './src/views'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure: makeProxyLogger(`backend ${apiTarget}`),
      },
      '/ai': {
        target: aiTarget,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/ai/, '/api/v1'),
        configure: makeProxyLogger(`ai ${aiTarget}`),
      },
      '/ws-ai': {
        target: aiTarget.replace(/^http/, 'ws'),
        ws: true,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/ws-ai/, '/api/v1/asr'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 15000,
  },
  };
});
