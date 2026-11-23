import { app, BrowserWindow, shell, session, dialog, net, globalShortcut } from 'electron'
import { createDownloads, registerMediaScheme, MEDIA_SCHEME } from './downloads/runtime'
import type { LocalPl, ScComment, ScMe, ScPlaylistRef, Settings, Track, WaveProfile } from '../shared/types'
import { settings } from './system/settings'
import { setupTray, attachWindow } from './system/tray'
import { setupUpdater, updates } from './system/updater'
import { DiscordPresence } from './system/discord'
import { buildActivity } from './system/discordActivity'
import type { DiscordUpdate } from '../shared/types'
import { join } from 'path'
import { VkClient, VK_UA } from './vk/client'
import { VkAudioApi, type AudioApi } from './vk/audio'
import { vkArtistWindow } from './vk/webArtists'
import { profileFollow } from './auth/profileFollow'
import { MockAudioApi } from './vk/mock'
import { startMockMedia } from './vk/mockServer'
import { fetchWebToken, loginWindow, logoutVk, userInfo, log } from './auth/webSession'
import { TokenKeeper } from './auth/webToken'
import { CaptchaGate, fetchImageDataUrl } from './auth/captcha'
import type { LoginStep } from '../shared/types'
import { registerCore, handle } from './ipc/handlers'
import { registerArtistSubscriptions } from './ipc/artistSubscriptions'
import { bootSafely } from './system/boot'
import { jsonFile } from './system/jsonFile'
import { SoundCloud, SC_DOWN, SC_NEED_KEY, ScUnavailable, type Fetch } from './sc/soundcloud'
import { scLoginWindow, scLogout, scProfileWindow, scToken, scWrite } from './sc/scAuth'
import type { ArtistRef, ArtistTrackLookup, Session } from '../shared/types'
import { ArtistTrackCatalog } from './metadata/artistTracks'

const MOCK = process.env.VK_MOCK === '1'
let win: BrowserWindow | null = null
let api: AudioApi
let keeper: TokenKeeper
/** VK_MOCK_LOGIN=1 — начать разлогиненным, чтобы проверить экран входа. */
let mockLoggedIn = process.env.VK_MOCK_LOGIN !== '1'
/** Ожидание ответа на капчу ВК — одно на всё приложение. */
const captcha = new CaptchaGate(undefined, () => win?.webContents.send('vk:captchaDone'))

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1400, height: 860, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#0B0B0B', show: false, title: 'Хвоя',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  w.once('ready-to-show', () => w.show())
  w.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F5' && !input.control && !input.alt && !input.shift && !input.meta) {
      event.preventDefault()
      if (!input.isAutoRepeat) w.webContents.reloadIgnoringCache()
    }
  })
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
  handle('win:reload', () => win?.webContents.reloadIgnoringCache())
  allowVkAudioCors()
  signVkAudioRequests()
  keeper = new TokenKeeper(fetchWebToken, Date.now, () => win?.webContents.send('auth:lost'))
  if (MOCK) {
    api = new MockAudioApi(await startMockMedia(join(app.getAppPath(), 'dev/fixtures')))
  } else {
    const client = new VkClient({
      token: async () => (await keeper.get())?.token ?? null,
      onTokenRejected: () => keeper.invalidate(),
      onAuthLost: () => { keeper.clear(); win?.webContents.send('auth:lost') },
      // Капча посреди работы: окно показывает картинку, ответ приходит каналом 'vk:captchaAnswer'
      onCaptcha: async (sid, img) => {
        const imageDataUrl = await fetchImageDataUrl(fetch, img).catch(() => '')
        if (!win || !imageDataUrl) { log('капча: не удалось показать картинку'); return '' }
        return captcha.ask(() => win!.webContents.send('vk:captcha', { sid, imageDataUrl }))
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
  let mockScUser = false
  const mockMe = (): ScMe | null => (mockScUser ? { id: 1, name: 'mor1us' } : null)
  const MOCK_SC_PLAYLISTS: ScPlaylistRef[] = [{ id: 1, title: 'Ночные поездки', count: 6, mine: true }, { id: 2, title: 'Phonk Drive', count: 8, mine: false }]
  const MOCK_SC_COMMENTS: ScComment[] = [{ at: 3, text: 'вот тут дроп 🔥', user: 'neon_fan' }, { at: 9, text: 'лучший момент', user: 'kid' }, { at: 20, text: 'на репите', user: 'synth' }]
  const scSearch = async (q: string): Promise<Track[]> => {
    if (SC_DOWN_TEST) throw new Error(SC_DOWN)
    if (!MOCK) return sc.search(q)
    const r = await api.search(q)
    return r.tracks.slice(0, 8).map((t) => ({ ...t, title: t.title + ' (SC edit)', id: 'sc_' + t.vkId, ownerId: 0, src: 'sc' as const, scStream: t.url, url: '' }))
  }
  const scStream = (t: Track) => (MOCK ? Promise.resolve(t.scStream ?? '') : sc.streamUrl(t))
  /** Ошибку SoundCloud — в журнал, кроме «недоступен» (она уже записана один раз в минуту). */
  const scLog = (what: string) => (e: unknown) => { if (!(e instanceof ScUnavailable)) log(`soundcloud: ${what} — ${(e as Error)?.message ?? e}`); throw e }
  handle('sc:search', (q: string) => scSearch(q).catch(scLog('поиск')))
  handle('sc:related', (t: Track) => (MOCK ? scSearch(t.artist) : sc.related(t)))
  handle('sc:artistTracks', (name: string, id?: string, offset?: number) => (MOCK ? (offset ? [] : scSearch(name)) : sc.artistTracks(name, 40, id, offset)))
  handle('scacc:artistInfo', (name: string, id?: string) => (MOCK ? { followed: false, can: false } : sc.artistInfo(name, id)))
  handle('scacc:artistFollow', (name: string, on: boolean, id?: string) => (MOCK ? undefined : sc.followArtist(name, on, id)))
  handle('scacc:openArtistProfile', (url: string) => scProfileWindow(win, url))
  handle('sc:stream', (t: Track) => scStream(t).catch(scLog('поток')))
  handle('sc:waveform', (t: Track, n?: number) => (MOCK ? [] : sc.waveform(t, n).catch(() => [])))
  handle('sc:resolve', async (url: string) => {
    if (!MOCK) return sc.resolve(url).catch(scLog('ссылка'))
    const tracks = await scSearch('Неон')
    return { kind: 'playlist' as const, title: 'Тестовый плейлист SoundCloud', author: 'mock', tracks }
  })
  handle('sc:suggest', async (q: string) => {
    if (SC_DOWN_TEST) return []
    if (!MOCK) return sc.suggest(q).catch(() => [])
    const r = await api.search(q)
    return [...new Set(r.tracks.flatMap((t) => [t.artist.toLowerCase(), `${t.artist} ${t.title}`.toLowerCase()]))].slice(0, 6)
  })
  handle('sc:users', async (q: string, limit = 4) => {
    if (SC_DOWN_TEST) throw new ScUnavailable()
    if (!MOCK) return sc.users(q, Number.isInteger(limit) ? Math.max(1, Math.min(limit, 20)) : 4).catch(scLog('поиск исполнителей'))
    const r = await scSearch(q)
    return [...new Set(r.map((t) => t.artist))].slice(0, 2).map((name) => ({ name: name + ' (SC)', followers: 1200 }))
  })
  handle('sc:searchPlaylists', async (q: string) => {
    if (SC_DOWN_TEST) return []
    if (MOCK) return [{ id: 11, title: `${q} — подборка SC`, count: 8, mine: false, author: 'synthboy' }, { id: 12, title: `Best of ${q}`, count: 5, mine: false, author: 'nightdj' }]
    return sc.searchPlaylists(q).catch(scLog('плейлисты'))
  })
  handle('sc:comments', (t: Track) => {
    if (MOCK) return MOCK_SC_COMMENTS
    return sc.comments(t).catch(() => [])
  })
  handle('sc:status', () => {
    if (SC_DOWN_TEST) return { ok: false, message: SC_DOWN, hasKey: false }
    if (MOCK) return { ok: true, hasKey: true }
    return sc.status()
  })
  handle('sc:prepare', () => {
    if (SC_DOWN_TEST) return { ok: false, message: SC_NEED_KEY, hasKey: false }
    if (MOCK) return { ok: true, hasKey: true }
    return sc.prepare()
  })
  // Аккаунт SoundCloud: вход через окно сайта, дальше — лайки, плейлисты, лента, лайк прямо на SoundCloud
  sc.setAuth(scToken)
  sc.setWriter(scWrite)
  handle('scacc:me', () => (MOCK ? mockMe() : sc.me().catch(() => null)))
  handle('scacc:login', async () => {
    if (MOCK) { mockScUser = true; return mockMe() }
    const r = await scLoginWindow(win, log)
    if ('error' in r) throw new Error(r.error)
    sc.forgetMe()
    return sc.me(true)
  })
  handle('scacc:logout', async () => { mockScUser = false; await scLogout(); sc.forgetMe(); log('soundcloud: выход из аккаунта') })
  handle('scacc:likes', async () => {
    if (!MOCK) return sc.likes()
    return mockScUser ? (await scSearch('Неон')).slice(0, 5) : []
  })
  handle('scacc:playlists', async () => {
    if (!MOCK) return sc.playlists()
    return mockScUser ? MOCK_SC_PLAYLISTS : []
  })
  handle('scacc:playlistTracks', (id: number) => (MOCK ? scSearch(id === 1 ? 'Кислота' : 'Неон') : sc.playlistTracks(id)))
  handle('scacc:feed', async () => {
    if (!MOCK) return sc.feed()
    return mockScUser ? scSearch('Пустой') : []
  })
  handle('vk:openArtistProfile', (url: string) => vkArtistWindow(win, url))
  const trackCatalog = new ArtistTrackCatalog((url, init) => net.fetch(url, init), log)
  handle('artists:trackMetadata', (artist: string, tracks: ArtistTrackLookup[]) => MOCK ? {} : trackCatalog.lookup(artist, tracks))
  const writingArtists = new Set<'vk' | 'sc'>()
  const mockArtistFollows = new Set<string>()
  handle('artists:follow', async (source: 'vk' | 'sc', account: number, artist: ArtistRef & { link?: string }, on?: boolean) => {
    if ((source !== 'vk' && source !== 'sc') || !Number.isSafeInteger(account) || account <= 0 || (on !== undefined && typeof on !== 'boolean')) throw new Error('Не удалось выбрать аккаунт подписки')
    const assertAccount = async () => {
      const current = source === 'sc' ? (MOCK ? mockMe()?.id : (await sc.me(true))?.id) : MOCK ? (mockLoggedIn ? 1 : 0) : keeper.userId()
      if (current !== account) throw new Error('Аккаунт изменился. Открой страницу артиста заново')
    }
    if (on !== undefined && writingArtists.has(source)) throw new Error('Другая подписка ещё меняется')
    if (on !== undefined) writingArtists.add(source)
    try {
      await assertAccount()
      if (MOCK) {
        const key = source + ':' + (artist.id || artist.name)
        if (on === true) mockArtistFollows.add(key)
        if (on === false) mockArtistFollows.delete(key)
        return mockArtistFollows.has(key)
      }
      if (artist.link) return await profileFollow(source, artist.link, on, assertAccount)
      const read = () => source === 'sc' ? sc.artistInfo(artist.name, artist.id) : api.artistInfo(artist)
      const before = await read()
      if (!before.can || before.statusUnknown || before.missing) throw new Error('Сервис не показал состояние подписки')
      if (on === undefined || on === before.followed) return before.followed
      await assertAccount()
      if (source === 'sc') await sc.followArtist(artist.name, on, before.id ?? artist.id)
      else await api.followArtist({ ...artist, id: before.id ?? artist.id }, on)
      const after = await read()
      if (!after.can || after.statusUnknown || after.followed !== on) throw new Error('Сервис не подтвердил изменение подписки')
      return after.followed
    } finally {
      if (on !== undefined) writingArtists.delete(source)
    }
  })
  registerArtistSubscriptions({
    window: () => win,
    vkUserId: () => keeper.userId(),
    soundCloudSubscriptions: async () => MOCK ? (mockScUser ? [] : null) : sc.artistSubscriptions(),
    mock: MOCK
  })
  handle('scacc:like', async (t: Track, on: boolean) => { if (!MOCK) await sc.setLike(t, on).catch(scLog('лайк')) })
  // Лайки SoundCloud и свои плейлисты Хвои (ВК + SoundCloud вперемешку) хранятся на компе.
  const scLikes = jsonFile<Track[]>('sc-likes.json', () => [])
  handle('scl:get', () => scLikes.read())
  handle('scl:set', (v: Track[]) => scLikes.write(v))
  const localPl = jsonFile<LocalPl[]>('khvoya-playlists.json', () => [])
  handle('lpl:get', () => localPl.read())
  handle('lpl:set', (v: LocalPl[]) => localPl.write(v))
  let changeTimer: NodeJS.Timeout | null = null
  const dl = createDownloads(() => settings.get().downloadDir, () => {
    if (changeTimer) return
    changeTimer = setTimeout(() => { changeTimer = null; win?.webContents.send('dl:changed') }, 300)
  }, async (t) => {
    if (t.src === 'sc') return scStream(t)
    if (t.url) return t.url
    const id = t.accessKey ? `${t.id}_${t.accessKey}` : t.id
    const [fresh] = await api.byId([id])
    return fresh?.available ? fresh.url : ''
  })
  handle('dl:start', (tracks: Track[]) => dl.enqueue(tracks))
  handle('dl:list', () => dl.list())
  handle('dl:cancel', (id: string) => dl.cancel(id))
  handle('dl:localPath', (id: string) => (dl.localPath(id) ? `${MEDIA_SCHEME}://local/${encodeURIComponent(id)}` : null))
  handle('dl:openFolder', (id?: string) => { const p = id ? dl.localPath(id) : null; if (p) shell.showItemInFolder(p); else void shell.openPath(settings.get().downloadDir) })
  handle('vk:captchaAnswer', (key: string) => captcha.answer(key))
  // Ошибки окна (интерфейса) — тоже в журнал, не чаще 30 в минуту
  let uiErrs = 0, uiErrsAt = 0
  handle('app:log', (msg: string) => {
    const now = Date.now()
    if (now - uiErrsAt > 60_000) { uiErrs = 0; uiErrsAt = now }
    if (++uiErrs <= 30) log('окно: ' + String(msg).slice(0, 500))
  })
  handle('settings:get', () => settings.get())
  handle('settings:set', (patch: Partial<Settings>) => settings.set(patch))
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
  let shortcuts: string[] = []
  const applyShortcuts = () => {
    shortcuts.forEach((accelerator) => globalShortcut.unregister(accelerator))
    shortcuts = []
    const bindings = [
      [settings.get().previousTrackShortcut, 'previous'],
      [settings.get().nextTrackShortcut, 'next'],
      [settings.get().pauseTrackShortcut, 'pause'],
      [settings.get().likeTrackShortcut, 'like'],
      [settings.get().dislikeTrackShortcut, 'dislike']
    ] as const
    for (const [accelerator, command] of bindings) {
      if (!accelerator || accelerator.toUpperCase() === 'F5' || shortcuts.includes(accelerator)) continue
      try {
        if (globalShortcut.register(accelerator, () => win?.webContents.send('tray:cmd', command))) shortcuts.push(accelerator)
        else log(`Не удалось включить сочетание клавиш «${accelerator}»`)
      } catch (e) {
        log(`Не удалось включить сочетание клавиш «${accelerator}»: ${(e as Error).message}`)
      }
    }
  }
  applyShortcuts()
  settings.onChange(applyShortcuts)
  handle('discord:update', (u: DiscordUpdate) => { lastU = { u, at: Date.now() }; if (settings.get().discordEnabled) discord.update(activityNow()) })
  app.on('before-quit', () => discord.stop())
  app.on('will-quit', () => globalShortcut.unregisterAll())
  const wave = jsonFile<WaveProfile | null>('wave-profile.json', () => null)
  handle('wave:get', () => wave.read())
  handle('wave:set', (p: WaveProfile) => wave.write(p))
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
registerMediaScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus() })
  app.whenReady().then(async () => {
    // Даже если подготовка упала, окно должно открыться: иначе Хвоя висит в процессах молча
    await bootSafely(setup, (e) => {
      log(`подготовка не удалась: ${(e as Error)?.message ?? e}`)
      dialog.showErrorBox('Хвоя', 'Не получилось подготовить Хвою — часть возможностей может не работать. Подробности в журнале: %APPDATA%/Хвоя/khvoya.log')
    })
    win = createWindow()
    win.on('closed', () => captcha.cancel()) // окна нет — ответа на капчу не будет
    attachWindow(win); setupTray(() => win); setupUpdater(() => win, log)
  })
  app.on('window-all-closed', () => app.quit())
  app.on('activate', () => win?.show())
}
