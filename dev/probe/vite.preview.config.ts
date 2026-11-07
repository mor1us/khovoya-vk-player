// ВЫБРАСЫВАЕМЫЙ КОД: собирает телефонный вид в одну папку для просмотра на компьютере.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = resolve(__dirname, '../..')
const entry = resolve(__dirname, 'preview.ts')

export default defineConfig({
  root: resolve(root, 'src/renderer'),
  base: './',
  resolve: { alias: { '@shared': resolve(root, 'src/shared'), '@': resolve(root, 'src/renderer') } },
  plugins: [
    react(),
    {
      name: 'khvoya-preview',
      transformIndexHtml: {
        order: 'pre' as const,
        handler(html: string) {
          return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '').replace('./main.tsx', entry)
        }
      }
    }
  ],
  build: {
    outDir: resolve(root, 'dist/preview'), emptyOutDir: true, target: 'esnext',
    // всё в один файл: шрифты в base64, динамический импорт не выносится в отдельный кусок
    assetsInlineLimit: 100000000, cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
})
