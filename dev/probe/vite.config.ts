// ВЫБРАСЫВАЕМЫЙ КОД: собирает src/renderer как обычный веб-сайт, без Electron.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = resolve(__dirname, '../..')
export default defineConfig({
  root: resolve(root, 'src/renderer'),
  base: './',
  resolve: { alias: { '@shared': resolve(root, 'src/shared'), '@': resolve(root, 'src/renderer') } },
  plugins: [
    react(),
    {
      name: 'probe-stub',
      transformIndexHtml(html) {
        // CSP из Electron-версии в проверке мешает — снимаем
        return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
      },
      transform(code, id) {
        // заглушка должна встать до самого окна — вшиваем её импортом в начало main.tsx
        if (id.endsWith('src/renderer/main.tsx')) return `import ${JSON.stringify(resolve(__dirname, 'stub.ts'))}\n` + code
      }
    }
  ],
  build: { outDir: resolve(root, 'dist-probe'), emptyOutDir: true }
})
