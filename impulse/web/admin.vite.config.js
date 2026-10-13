import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';

let apiServerProcess;
function startApiServer() {
  if (apiServerProcess) return;

  // Check whether port 4001 is already in use; if so, skip spawning.
  const sock = new net.Socket();
  sock.setTimeout(500);
  sock.on('connect', () => {
    sock.destroy();
    // Port in use — do not spawn a new server to avoid EADDRINUSE
    console.log('API port 4001 already in use, skipping spawn');
  });
  sock.on('timeout', () => { sock.destroy(); });
  sock.on('error', () => {
    // Port not in use — safe to spawn
    apiServerProcess = spawn('node', [path.resolve(__dirname, '../server/index.js')], {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    const cleanup = () => {
      if (apiServerProcess && !apiServerProcess.killed) {
        try { apiServerProcess.kill(); } catch (e) {}
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });

  sock.connect(4001, '127.0.0.1');
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'start-api-server',
      configureServer() {
        startApiServer();
      },
    },
  ],
  server: {
    port: 4000,
    proxy: {
      '/api': 'http://localhost:4001',
      '/uploads': 'http://localhost:4001',
    },
  },
  root: path.resolve(__dirname, 'admin'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/apps/admin'),
    emptyOutDir: false,
  },
});
