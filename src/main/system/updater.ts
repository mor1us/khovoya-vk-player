import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { feedFromConfig, updateConfigYaml, type UpdateState } from '../../shared/updates'
import { UPDATE_FEED } from '../../shared/updateFeed'

let state: UpdateState = { status: 'idle', current: app.getVersion() }
let getWin: () => BrowserWindow | null = () => null
const set = (s: Partial<UpdateState>) => { state = { ...state, ...s, current: app.getVersion() }; getWin()?.webContents.send('upd:changed', state) }

/**
 * Рядом с установленной Хвоей лежит app-update.yml от electron-builder, а в сборке через `--dir` его нет,
 * и electron-updater падает с ENOENT ещё до запроса — человек видит «Не удалось проверить обновления».
 * Адрес релизов известен из UPDATE_FEED, поэтому пишем такой файл себе в данные приложения.
 */
function configPath(feed: { provider: string; owner: string; repo: string }, log: (m: string) => void): void {
  if (existsSync(join(process.resourcesPath, 'app-update.yml'))) return
  const mine = join(app.getPath('userData'), 'app-update.yml')
  try {
    writeFileSync(mine, updateConfigYaml(feed))
    autoUpdater.updateConfigPath = mine
    log('обновление: сборка без app-update.yml — взял адрес из настроек')
  } catch (e: any) {
    log(`обновление: не вышло записать app-update.yml — ${e?.message ?? e}`)
  }
}

export function setupUpdater(win: () => BrowserWindow | null, log: (m: string) => void) {
  getWin = win
  const feed = feedFromConfig(UPDATE_FEED)
  if (!feed || !app.isPackaged) { set({ status: 'disabled' }); return }
  configPath(feed, log)
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
