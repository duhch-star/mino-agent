import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    watch: {
      // 避免 watch 大体积模型与编辑器临时文件时 EBUSY 崩溃：
      //  - public 下的静态资源（65MB GLB）无需热更新监视
      //  - 编辑器原子写产生的 .tmp 临时文件（.gitignore.tmp 等）
      ignored: ['**/public/**', '**/*.tmp', '**/.*.tmp*', '**/node_modules/**'],
    },
  },
})
