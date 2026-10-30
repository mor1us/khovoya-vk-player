import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { settings } from './settings'

let tray: Tray | null = null
let quitting = false

const send = (w: BrowserWindow | null, cmd: string) => w?.webContents.send('tray:cmd', cmd)

/** Фоновый режим: свернули/спрятали → окно ничего не рисует и не анимирует. */
function setBackground(w: BrowserWindow, bg: boolean) {
  w.webContents.setBackgroundThrottling(bg)
  w.webContents.send('sys:state', { background: bg })
}

export function setupTray(getWin: () => BrowserWindow | null) {
  const icon = nativeImage.createFromPath(join(app.getAppPath(), 'resources/tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Хвоя')
  const show = () => { const w = getWin(); if (!w) return; if (w.isMinimized()) w.restore(); w.show(); w.focus() }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Показать', click: show },
    { label: 'Пауза / играть', click: () => send(getWin(), 'toggle') },
    { label: 'Следующий', click: () => send(getWin(), 'next') },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit() } }
  ]))
  tray.on('click', show)
  app.on('before-quit', () => { quitting = true })
}

export function attachWindow(w: BrowserWindow) {
  w.on('minimize', () => setBackground(w, true))
  w.on('hide', () => setBackground(w, true))
  w.on('restore', () => setBackground(w, false))
  w.on('show', () => setBackground(w, false))
  w.on('close', (e) => {
    if (!quitting && settings.get().closeToTray) { e.preventDefault(); w.hide() }
  })
}
