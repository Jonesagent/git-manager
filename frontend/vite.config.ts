import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3011',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
