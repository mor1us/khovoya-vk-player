import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { feedFromConfig, type UpdateState } from '../../shared/updates'
import { UPDATE_FEED } from '../../shared/updateFeed'

let state: UpdateState = { status: 'idle', current: app.getVersion() }
let getWin: () => BrowserWindow | null = () => null
const set = (s: Partial<UpdateState>) => { state = { ...state, ...s, current: app.getVersion() }; getWin()?.webContents.send('upd:changed', state) }

export function setupUpdater(win: () => BrowserWindow | null, log: (m: string) => void) {
  getWin = win
  const feed = feedFromConfig(UPDATE_FEED)
  if (!feed || !app.isPackaged) { set({ status: 'disabled' }); return }
  autoUpdater.setFeedURL(feed)
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => set({ status: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ status: 'none' }))
  autoUpdater.on('update-available', (i) => set({ status: 'available', version: i.version }))
  autoUpdater.on('download-progress', (p) => set({ status: 'downloading', progress: p.percent / 100 }))
  autoUpdater.on('update-downloaded', (i) => set({ status: 'ready', version: i.version }))
  autoUpdater.on('error', (e) => { log(`обновление: ${e?.message ?? e}`); set({ status: 'error' }) })
  const check = () => { void autoUpdater.checkForUpdates().catch(() => {}) }
  setTimeout(check, 10_000)
  setInterval(check, 6 * 3600_000)
}

export const updates = {
  state: () => state,
  check: () => { if (state.status !== 'disabled') void autoUpdater.checkForUpdates().catch(() => {}); return state },
  download: () => { void autoUpdater.downloadUpdate().catch(() => set({ status: 'error' })) },
  install: () => autoUpdater.quitAndInstall(false, true)
}
