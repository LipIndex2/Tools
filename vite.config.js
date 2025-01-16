import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import renderer from 'vite-plugin-electron-renderer';
const path = require('path');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    renderer({
      nodeIntegration: true
    })
  ],
  resolve: {
    alias: {
      '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
      '@': fileURLToPath(new URL('./renderer', import.meta.url))
    }
  }
})
