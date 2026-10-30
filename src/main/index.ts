import { app, BrowserWindow, shell, session, dialog } from 'electron'
import { createDownloads, registerMediaScheme, MEDIA_SCHEME } from './downloads/runtime'
import type { Track, Settings } from '../shared/types'
import { settings } from './system/settings'
import { setupTray, attachWindow } from './system/tray'
import { DiscordPresence } from './system/discord'
import { buildActivity } from './system/discordActivity'
import type { DiscordUpdate } from '../shared/types'
import { join } from 'path'
import { VkClient, VK_UA } from './vk/client'
import { VkAudioApi, type AudioApi } from './vk/audio'
import { MockAudioApi } from './vk/mock'
import { startMockMedia } from './vk/mockServer'
import { fetchWebToken, loginWindow, logoutVk, userInfo, log } from './auth/webSession'
import { TokenKeeper } from './auth/webToken'
import { fetchImageDataUrl } from './auth/captcha'
import type { LoginStep } from '../shared/types'
import { registerCore, handle } from './ipc/handlers'
import { jsonFile } from './system/jsonFile'
import type { Session } from '../shared/types'

const MOCK = process.env.VK_MOCK === '1'
let win: BrowserWindow | null = null
let api: AudioApi
let keeper: TokenKeeper
let mockLoggedIn = process.env.VK_MOCK_LOGIN !== '1'

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1400, height: 860, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#0B0B0B', show: false, title: 'Хвоя',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  w.once('ready-to-show', () => w.show())
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' } })
  w.webContents.on('will-navigate', (e) => e.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) w.loadURL(process.env.ELECTRON_RENDERER_URL)
  else w.loadFile(join(__dirname, '../renderer/index.html'))
  return w
}

/** Аудио ВК идёт через Web Audio (кроссфейд), а ему нужен CORS. Добавляем заголовок к ответам аудио-серверов ВК. */
function allowVkAudioCors() {
  const filter = { urls: ['https://*.vkuseraudio.net/*', 'https://*.vkuseraudio.com/*', 'https://*.vk-cdn.net/*', 'https://*.userapi.com/*', 'https://*.vk.me/*', 'https://*.mycdn.me/*'] }
  session.defaultSession.webRequest.onHeadersReceived(filter, (d, cb) => {
    const h = { ...d.responseHeaders }
    for (const k of Object.keys(h)) if (k.toLowerCase() === 'access-control-allow-origin') delete h[k]
    h['Access-Control-Allow-Origin'] = ['*']
    cb({ responseHeaders: h })
  })
}

/** Запросы плеера к серверам музыки ВК — с подписью официального приложения (как у VK Android). */
function signVkAudioRequests() {
  const filter = { urls: ['https://*.vkuseraudio.net/*', 'https://*.vkuseraudio.com/*', 'https://*.vk-cdn.net/*', 'https://*.mycdn.me/*'] }
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (d, cb) => {
    cb({ requestHeaders: { ...d.requestHeaders, 'User-Agent': VK_UA, 'X-VK-Android-Client': 'new' } })
  })
}

async function setup() {
  allowVkAudioCors()
  signVkAudioRequests()
  keeper = new TokenKeeper(fetchWebToken, Date.now, () => win?.webContents.send('auth:lost'))
  if (MOCK) {
    api = new MockAudioApi(await startMockMedia(join(app.getAppPath(), 'dev/fixtures')))
  } else {
    // Капча посреди работы: просим окно показать картинку и ждём ответ (пока — пропуск, ответ придёт в Task 10).
    const client = new VkClient({
      token: async () => (await keeper.get())?.token ?? null,
      onTokenRejected: () => keeper.invalidate(),
      onAuthLost: () => { keeper.clear(); win?.webContents.send('auth:lost') },
      onCaptcha: async (sid, img) => {
        const imageDataUrl = await fetchImageDataUrl(fetch, img).catch(() => '')
        if (!win || !imageDataUrl) return ''
        return new Promise<string>((resolve) => {
          handle('vk:captchaAnswer', (key: string) => { resolve(String(key ?? '')) })
          win!.webContents.send('vk:captcha', { sid, imageDataUrl })
        })
      }
    })
    api = new VkAudioApi(client, () => keeper.userId(), log)
  }
  registerCore({
    win: () => win,
    api: () => api,
    logout: () => { if (MOCK) mockLoggedIn = false; else { keeper.clear(); void logoutVk() } },
    session: async (): Promise<Session> => {
      if (MOCK) return mockLoggedIn ? { loggedIn: true, userName: 'Мориус', userId: 1 } : { loggedIn: false }
      const t = await keeper.get()
      if (!t) return { loggedIn: false }
      const me = await userInfo(t.token)
      return { loggedIn: true, userName: me.name, avatar: me.avatar, userId: t.userId }
    }
  })
  let changeTimer: NodeJS.Timeout | null = null
  const dl = createDownloads(() => settings.get().downloadDir, () => {
    if (changeTimer) return
    changeTimer = setTimeout(() => { changeTimer = null; win?.webContents.send('dl:changed') }, 300)
  })
  handle('dl:start', (tracks: Track[]) => dl.enqueue(tracks))
  handle('dl:list', () => dl.list())
  handle('dl:cancel', (id: string) => dl.cancel(id))
  handle('dl:localPath', (id: string) => (dl.localPath(id) ? `${MEDIA_SCHEME}://local/${encodeURIComponent(id)}` : null))
  handle('dl:openFolder', (id?: string) => { const p = id ? dl.localPath(id) : null; if (p) shell.showItemInFolder(p); else void shell.openPath(settings.get().downloadDir) })
  handle('settings:get', () => settings.get())
  handle('settings:set', (patch: Partial<Settings>) => settings.set(patch))
  handle('win:close', () => win?.close())
  handle('settings:pickDir', async () => {
    if (!win) return null
    const r = await dialog.showOpenDialog(win, { title: 'Папка для скачанной музыки', defaultPath: settings.get().downloadDir, properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('auth:browser', async (): Promise<LoginStep> => {
    if (MOCK) { mockLoggedIn = true; return { kind: 'ok', userName: 'Мориус' } }
    const r = await loginWindow(win)
    if ('error' in r) return { kind: 'error', message: r.error }
    keeper.set(r)
    const t = r
    const me = await userInfo(t.token)
    return { kind: 'ok', userName: me.name, avatar: me.avatar }
  })
  const discord = new DiscordPresence()
  const applyDiscord = () => { const s = settings.get(); if (s.discordEnabled && s.discordAppId) discord.start(s.discordAppId); else discord.stop() }
  applyDiscord()
  settings.onChange(applyDiscord)
  handle('discord:update', (u: DiscordUpdate) => { if (settings.get().discordEnabled) discord.update(buildActivity(u.track, u.playing, u.position, Date.now())) })
  app.on('before-quit', () => discord.stop())
  const wave = jsonFile<unknown>('wave-profile.json', () => null)
  handle('wave:get', () => wave.read())
  handle('wave:set', (p: unknown) => wave.write(p))
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
registerMediaScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus() })
  app.whenReady().then(async () => { await setup(); win = createWindow(); attachWindow(win); setupTray(() => win) })
  app.on('window-all-closed', () => app.quit())
  app.on('activate', () => win?.show())
}
