import { app, BrowserWindow, shell, session, dialog } from 'electron'
import { createDownloads, registerMediaScheme, MEDIA_SCHEME } from './downloads/runtime'
import type { Track, Settings } from '../shared/types'
import { settings } from './system/settings'
import { setupTray, attachWindow } from './system/tray'
import { DiscordPresence } from './system/discord'
import { buildActivity } from './system/discordActivity'
import type { DiscordUpdate } from '../shared/types'
import { join } from 'path'
import { VkClient } from './vk/client'
import { VkAudioApi, type AudioApi } from './vk/audio'
import { MockAudioApi } from './vk/mock'
import { startMockMedia } from './vk/mockServer'
import { login, userInfo, fetchImageDataUrl } from './auth/kate'
import { authorizeUrl, parseRedirect, parseManual, BROWSER_UA } from './auth/browserLogin'
import type { LoginStep } from '../shared/types'
import { TokenStore } from './auth/tokenStore'
import { registerCore, handle } from './ipc/handlers'
import { jsonFile } from './system/jsonFile'
import type { Session } from '../shared/types'

const MOCK = process.env.VK_MOCK === '1'
let win: BrowserWindow | null = null
let api: AudioApi
let store: TokenStore
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

async function setup() {
  allowVkAudioCors()
  store = new TokenStore()
  if (MOCK) {
    api = new MockAudioApi(await startMockMedia(join(app.getAppPath(), 'dev/fixtures')))
  } else {
    // Капча посреди работы: просим окно показать картинку и ждём ответ (пока — пропуск, ответ придёт в Task 10).
    const client = new VkClient({
      token: () => store.load()?.token ?? null,
      onAuthLost: () => { store.clear(); win?.webContents.send('auth:lost') },
      onCaptcha: async (sid, img) => {
        const imageDataUrl = await fetchImageDataUrl(fetch, img).catch(() => '')
        if (!win || !imageDataUrl) return ''
        return new Promise<string>((resolve) => {
          handle('vk:captchaAnswer', (key: string) => { resolve(String(key ?? '')) })
          win!.webContents.send('vk:captcha', { sid, imageDataUrl })
        })
      }
    })
    api = new VkAudioApi(client, () => store.load()?.userId ?? 0)
  }
  registerCore({
    win: () => win,
    api: () => api,
    login: async (i) => (MOCK ? ((mockLoggedIn = true), { kind: 'ok', userName: 'Мориус' }) : login(i, { fetch, store })),
    logout: () => { if (MOCK) mockLoggedIn = false; else store.clear() },
    session: async (): Promise<Session> => {
      if (MOCK) return mockLoggedIn ? { loggedIn: true, userName: 'Мориус', userId: 1 } : { loggedIn: false }
      const s = store.load()
      if (!s) return { loggedIn: false }
      const me = await userInfo(fetch, s.token)
      return { loggedIn: true, userName: me.name, avatar: me.avatar, userId: s.userId }
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
  handle('auth:browser', () => (MOCK ? ((mockLoggedIn = true), { kind: 'ok', userName: 'Мориус' }) : browserLogin()))
  handle('auth:openBrowser', () => shell.openExternal(authorizeUrl()))
  handle('auth:token', async (text: string): Promise<LoginStep> => {
    const r = parseManual(String(text ?? ''))
    if (!r) return { kind: 'error', message: 'Не нашёл ключ в этой ссылке. Скопируй адрес страницы целиком после входа.' }
    if (MOCK) { mockLoggedIn = true; return { kind: 'ok', userName: 'Мориус' } }
    const me = await userInfo(fetch, r.token)
    if (!me.id) return { kind: 'error', message: 'Ключ не подошёл. Войди ещё раз и скопируй новую ссылку.' }
    store.save({ token: r.token, userId: r.userId || me.id })
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

/** Окно ВК для входа: код, SMS, QR. Пароль приложение не видит, забираем только ключ из адреса после входа. */
function browserLogin(): Promise<LoginStep> {
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      width: 520, height: 720, parent: win ?? undefined, modal: !!win, title: 'Вход через ВК', autoHideMenuBar: true, backgroundColor: '#ffffff',
      webPreferences: { partition: 'vkauth', contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    let done = false
    const finish = async (r: LoginStep) => { if (done) return; done = true; if (!w.isDestroyed()) w.close(); resolve(r) }
    const check = async (url: string) => {
      const r = parseRedirect(url)
      if (!r) return
      if ('error' in r) return finish({ kind: 'error', message: r.error })
      store.save({ token: r.token, userId: r.userId })
      const me = await userInfo(fetch, r.token)
      void finish({ kind: 'ok', userName: me.name, avatar: me.avatar })
    }
    const wc = w.webContents
    wc.setUserAgent(BROWSER_UA)
    wc.on('will-redirect', (_e, url) => void check(url))
    wc.on('will-navigate', (_e, url) => void check(url))
    wc.on('did-navigate', (_e, url) => void check(url))
    wc.on('did-redirect-navigation', (_e, url) => void check(url))
    wc.setWindowOpenHandler(({ url }) => { void wc.loadURL(url); return { action: 'deny' } })
    w.on('closed', () => { if (!done) { done = true; resolve({ kind: 'error', message: 'Окно входа закрыто' }) } })
    void w.loadURL(authorizeUrl(), { userAgent: BROWSER_UA })
  })
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
