import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 5174, strictPort: true },
  // Module workers: MediaPipe's ES-module WASM loader (useModule=true) runs inside them.
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' }
})
