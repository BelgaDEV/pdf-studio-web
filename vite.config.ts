import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    // Os wrappers WASM criam Web Workers e resolvem .wasm via import.meta.url.
    // Não deixamos o esbuild pré-empacotá-los no dev server para preservar URLs.
    exclude: ['@wasm-zoo/ghostscript', '@wasm-zoo/qpdf'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2200,
  },
})
