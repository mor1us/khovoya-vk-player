// Сборка окна для телефона: тот же src/renderer, что и на компьютере, без Electron.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = __dirname
const entry = resolve(root, 'src/mobile/boot.ts')

export default defineConfig({
  root: resolve(root, 'src/renderer'),
  base: './',
  resolve: { alias: { '@shared': resolve(root, 'src/shared'), '@': resolve(root, 'src/renderer') } },
  plugins: [
    react(),
    {
      name: 'khvoya-mobile-bridge',
      // order: 'pre' обязателен — иначе Vite успеет разобрать html и подменять точку входа уже поздно
      transformIndexHtml: {
        order: 'pre' as const,
        handler(html: string) {
          // CSP из Electron-версии держится на file:// и khvoya-media: — в WebView она не нужна,
          // а точка входа своя: сначала мост, потом окно
          return html
            .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
            .replace('./main.tsx', entry)
        }
      }
    }
  ],
  // верхнеуровневый await в boot.ts
  build: { outDir: resolve(root, 'dist/mobile'), emptyOutDir: true, target: 'esnext' }
})
