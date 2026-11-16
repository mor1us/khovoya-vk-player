import { app, BrowserWindow, screen } from 'electron'
import { existsSync } from 'fs'
import { randomInt } from 'crypto'
import { join } from 'path'
import { jsonFile } from './jsonFile'

let overlay: BrowserWindow | null = null

export async function playScreamer() {
  if (overlay) return
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = Math.min(640, area.width, Math.floor(area.height * 16 / 9))
  const height = Math.round(width * 9 / 16)
  const w = new BrowserWindow({
    width, height,
    x: area.x + Math.floor((area.width - width) / 2),
    y: area.y + Math.floor((area.height - height) / 2),
    show: false, frame: false, transparent: true, focusable: false, skipTaskbar: true,
    resizable: false, hasShadow: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  })
  overlay = w
  const timeout = setTimeout(() => { if (!w.isDestroyed()) w.destroy() }, 5000)
  w.once('closed', () => { clearTimeout(timeout); overlay = null })
  w.setIgnoreMouseEvents(true)
  w.setAlwaysOnTop(true, 'screen-saver')
  try {
    await w.loadFile(join(app.getAppPath(), 'resources/screamer/index.html'))
    w.showInactive()
    await w.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const video = document.querySelector('video')
        video.addEventListener('ended', resolve, { once: true })
        video.addEventListener('error', () => reject(new Error('Не удалось загрузить ролик')), { once: true })
        video.volume = 1
        video.play().catch(reject)
      })
    `)
  } finally {
    if (!w.isDestroyed()) w.destroy()
  }
}

export function scheduleUpdateScreamer(log: (message: string) => void) {
  if (!app.isPackaged || process.platform !== 'win32') return
  try {
    const version = app.getVersion()
    const last = jsonFile<{ version?: string } | null>('last-launch.json', () => null)
    const previous = last.read()?.version
    if (previous === version) return
    // До появления файла версии распознаём старую установку по данным окна.
    const updated = typeof previous === 'string'
      ? version.localeCompare(previous, 'en', { numeric: true }) > 0
      : existsSync(join(app.getPath('userData'), 'Local Storage', 'leveldb', 'CURRENT'))
    last.write({ version })
    if (!updated || randomInt(100) >= 35) return
    const timer = setTimeout(() => {
      void playScreamer().catch((e: Error) => log(`скример: ${e.message}`))
    }, randomInt(120_000, 480_001))
    app.once('before-quit', () => clearTimeout(timer))
  } catch (e) {
    log(`скример: ${(e as Error).message}`)
  }
}
