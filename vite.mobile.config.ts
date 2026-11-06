// Сборка окна для телефона: тот же src/renderer, что и на компьютере, без Electron.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = __dirname
// ВРЕМЕННО: пока нет src/mobile/bridge.ts, вместо window.api подставляется заглушка из проверки.
// Убирает Task 5 плана 2026-11-06-android-core.
const bridge = resolve(root, 'dev/probe/stub.ts')

export default defineConfig({
  root: resolve(root, 'src/renderer'),
  base: './',
  resolve: { alias: { '@shared': resolve(root, 'src/shared'), '@': resolve(root, 'src/renderer') } },
  plugins: [
    react(),
    {
      name: 'khvoya-mobile-bridge',
      transformIndexHtml(html) {
        // CSP из Electron-версии держится на file:// и khvoya-media: — в WebView она не нужна
        return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
      },
      transform(code, id) {
        // мост должен встать до окна — вшиваем импортом в начало main.tsx
        if (id.endsWith('src/renderer/main.tsx')) return `import ${JSON.stringify(bridge)}\n` + code
      }
    }
  ],
  build: { outDir: resolve(root, 'dist/mobile'), emptyOutDir: true }
})
