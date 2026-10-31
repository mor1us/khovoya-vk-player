import { app, BrowserWindow, shell, session, dialog, net } from 'electron'
import { createDownloads, registerMediaScheme, MEDIA_SCHEME } from './downloads/runtime'
import type { Track, Settings } from '../shared/types'
import { settings } from './system/settings'
import { setupTray, attachWindow } from './system/tray'
import { setupUpdater, updates } from './system/updater'
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
import { SoundCloud, SC_DOWN, SC_NEED_KEY, type Fetch } from './sc/soundcloud'
import { scLoginWindow, scLogout, scToken, scWrite } from './sc/scAuth'
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

/** Аудио ВК и SoundCloud идёт через Web Audio (кроссфейд), а ему нужен CORS. Добавляем заголовок к ответам их аудио-серверов. */
function allowVkAudioCors() {
  const filter = { urls: ['https://*.vkuseraudio.net/*', 'https://*.vkuseraudio.com/*', 'https://*.vk-cdn.net/*', 'https://*.userapi.com/*', 'https://*.vk.me/*', 'https://*.mycdn.me/*', 'https://*.sndcdn.com/*', 'https://*.soundcloud.cloud/*'] }
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
  // SoundCloud: поиск и прослушивание без входа. В тестовом режиме — подделка поверх тестовых треков.
  // Ключ SoundCloud хранится на компе: получив его один раз (с VPN), дальше можно без VPN
  const scKey = jsonFile<{ clientId?: string; at?: number }>('soundcloud.json', () => ({}))
  const sc = new SoundCloud(net.fetch as unknown as Fetch, { get: () => scKey.read().clientId ?? null, set: (v) => scKey.write({ clientId: v, at: Date.now() }), at: () => scKey.read().at ?? 0 }, log)
  if (!MOCK) { // пока сайт открывается (например, включён VPN) — тихо держим ключ свежим
    setTimeout(() => void sc.refreshKey(), 20_000)
    setInterval(() => void sc.refreshKey(), 6 * 3600_000)
  }
  const SC_DOWN_TEST = MOCK && process.env.SC_DOWN === '1' // тестовый режим «SoundCloud заблокирован»
  const scSearch = async (q: string): Promise<Track[]> => {
    if (SC_DOWN_TEST) throw new Error(SC_DOWN)
    if (!MOCK) return sc.search(q)
    const r = await api.search(q)
    return r.tracks.slice(0, 8).map((t) => ({ ...t, title: t.title + ' (SC edit)', id: 'sc_' + t.vkId, ownerId: 0, src: 'sc' as const, scStream: t.url, url: '' }))
  }
  const scStream = (t: Track) => (MOCK ? Promise.resolve(t.scStream ?? '') : sc.streamUrl(t))
  handle('sc:search', (q: string) => scSearch(q).catch((e) => { log('soundcloud: поиск — ' + (e as Error).message); throw e }))
  handle('sc:related', (t: Track) => (MOCK ? scSearch(t.artist) : sc.related(t)))
  handle('sc:resolve', async (url: string) => {
    if (!MOCK) return sc.resolve(url).catch((e) => { log('soundcloud: ссылка — ' + (e as Error).message); throw e })
    const tracks = await scSearch('Неон')
    return { kind: 'playlist', title: 'Тестовый плейлист SoundCloud', author: 'mock', tracks }
  })
  handle('sc:suggest', async (q: string) => {
    if (SC_DOWN_TEST) return []
    if (!MOCK) return sc.suggest(q).catch(() => [])
    const r = await api.search(q)
    return [...new Set(r.tracks.flatMap((t) => [t.artist.toLowerCase(), `${t.artist} ${t.title}`.toLowerCase()]))].slice(0, 6)
  })
  // Аккаунт SoundCloud: вход через окно сайта, дальше — лайки, плейлисты, лента, лайк прямо на SoundCloud
  sc.setAuth(scToken)
  sc.setWriter(scWrite)
  let mockScUser = false
  const mockMe = () => (mockScUser ? { id: 1, name: 'mor1us', avatar: undefined } : null)
  handle('scacc:me', () => (MOCK ? mockMe() : sc.me().catch(() => null)))
  handle('scacc:login', async () => {
    if (MOCK) { mockScUser = true; return mockMe() }
    const r = await scLoginWindow(win, log)
    if ('error' in r) throw new Error(r.error)
    sc.forgetMe()
    return sc.me(true)
  })
  handle('scacc:logout', async () => { mockScUser = false; await scLogout(); sc.forgetMe(); log('soundcloud: выход из аккаунта') })
  handle('scacc:likes', async () => (MOCK ? (mockScUser ? (await scSearch('Неон')).slice(0, 5) : []) : sc.likes()))
  handle('scacc:playlists', async () => (MOCK ? (mockScUser ? [{ id: 1, title: 'Ночные поездки', count: 6, mine: true }, { id: 2, title: 'Phonk Drive', count: 8, mine: false }] : []) : sc.playlists()))
  handle('scacc:playlistTracks', async (id: number) => (MOCK ? scSearch(id === 1 ? 'Кислота' : 'Неон') : sc.playlistTracks(id)))
  handle('scacc:feed', async () => (MOCK ? (mockScUser ? scSearch('Пустой') : []) : sc.feed()))
  handle('scacc:like', async (t: Track, on: boolean) => (MOCK ? null : sc.setLike(t, on).catch((e) => { log('soundcloud: лайк — ' + (e as Error).message); throw e })))
  handle('sc:status', () => (SC_DOWN_TEST ? { ok: false, message: SC_DOWN, hasKey: false } : MOCK ? { ok: true, hasKey: true } : sc.status()))
  handle('sc:prepare', () => (SC_DOWN_TEST ? { ok: false, message: SC_NEED_KEY, hasKey: false } : MOCK ? { ok: true, hasKey: true } : sc.prepare()))
  handle('sc:users', async (q: string) => {
    if (SC_DOWN_TEST) return []
    if (!MOCK) return sc.users(q).catch(() => [])
    const r = await scSearch(q)
    return [...new Set(r.map((t) => t.artist))].slice(0, 2).map((name) => ({ name: name + ' (SC)', followers: 1200 }))
  })
  handle('sc:waveform', (t: Track, n?: number) => (MOCK ? [] : sc.waveform(t, n).catch(() => [])))
  handle('sc:comments', (t: Track) => (MOCK
    ? [{ at: 3, text: 'вот тут дроп 🔥', user: 'neon_fan' }, { at: 9, text: 'лучший момент', user: 'kid' }, { at: 20, text: 'на репите', user: 'synth' }]
    : sc.comments(t).catch(() => [])))
  handle('sc:stream', (t: Track) => scStream(t).catch((e) => { log('soundcloud: поток — ' + (e as Error).message); throw e }))
  // Лайки SoundCloud и свои плейлисты Хвои (ВК + SoundCloud вперемешку) хранятся на компе.
  const scLikes = jsonFile<unknown[]>('sc-likes.json', () => [])
  handle('scl:get', () => scLikes.read())
  handle('scl:set', (v: unknown[]) => scLikes.write(v))
  const localPl = jsonFile<unknown[]>('khvoya-playlists.json', () => [])
  handle('lpl:get', () => localPl.read())
  handle('lpl:set', (v: unknown[]) => localPl.write(v))
  let changeTimer: NodeJS.Timeout | null = null
  const dl = createDownloads(() => settings.get().downloadDir, () => {
    if (changeTimer) return
    changeTimer = setTimeout(() => { changeTimer = null; win?.webContents.send('dl:changed') }, 300)
  }, async (t) => (t.src === 'sc' ? scStream(t) : t.url))
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
  handle('upd:state', () => updates.state())
  handle('upd:check', () => updates.check())
  handle('upd:download', () => updates.download())
  handle('upd:install', () => updates.install())
  const discord = new DiscordPresence(log)
  // Последнее состояние плеера храним всегда: если статус включат посреди трека, он появится сразу.
  let lastU: { u: DiscordUpdate; at: number } | null = null
  const activityNow = () => {
    if (!lastU) return null
    const { u, at } = lastU
    return buildActivity(u.track, u.playing, u.position + (u.playing ? (Date.now() - at) / 1000 : 0), Date.now())
  }
  const applyDiscord = () => {
    const s = settings.get()
    if (s.discordEnabled && s.discordAppId.trim()) { discord.start(s.discordAppId.trim()); discord.update(activityNow()) } else discord.stop()
  }
  applyDiscord()
  settings.onChange(applyDiscord)
  handle('discord:update', (u: DiscordUpdate) => { lastU = { u, at: Date.now() }; if (settings.get().discordEnabled) discord.update(activityNow()) })
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
  app.whenReady().then(async () => { await setup(); win = createWindow(); attachWindow(win); setupTray(() => win); setupUpdater(() => win, log) })
  app.on('window-all-closed', () => app.quit())
  app.on('activate', () => win?.show())
}
