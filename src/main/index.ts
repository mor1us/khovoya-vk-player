import { app, BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { VkClient } from './vk/client'
import { VkAudioApi, type AudioApi } from './vk/audio'
import { MockAudioApi } from './vk/mock'
import { startMockMedia } from './vk/mockServer'
import { login, userInfo, fetchImageDataUrl } from './auth/kate'
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
  const wave = jsonFile<unknown>('wave-profile.json', () => null)
  handle('wave:get', () => wave.read())
  handle('wave:set', (p: unknown) => wave.write(p))
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus() })
  app.whenReady().then(async () => { await setup(); win = createWindow() })
  app.on('window-all-closed', () => app.quit())
}
