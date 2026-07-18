import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // Use a relative base path when deploying to a GitHub Pages project site (https://<user>.github.io/<repo>/);
  // 部署到 GitHub Pages 项目站点（https://<user>.github.io/<repo>/）时使用相对路径，
  // it also works for local dev and preview, so no need to distinguish environments.
  // 本地开发与预览同样适用，无需区分环境。
  base: './',
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
