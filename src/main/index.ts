import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { VkClient } from './vk/client'
import { VkAudioApi, type AudioApi } from './vk/audio'
import { MockAudioApi } from './vk/mock'
import { startMockMedia } from './vk/mockServer'
import { login, userInfo, fetchImageDataUrl } from './auth/kate'
import { TokenStore } from './auth/tokenStore'
import { registerCore } from './ipc/handlers'
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

async function setup() {
  store = new TokenStore()
  if (MOCK) {
    api = new MockAudioApi(await startMockMedia(join(app.getAppPath(), 'dev/fixtures')))
  } else {
    // Капча посреди работы: просим окно показать картинку и ждём ответ (пока — пропуск, ответ придёт в Task 10).
    const client = new VkClient({
      token: () => store.load()?.token ?? null,
      onAuthLost: () => { store.clear(); win?.webContents.send('auth:lost') },
      onCaptcha: async () => ''
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
  void fetchImageDataUrl
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus() })
  app.whenReady().then(async () => { await setup(); win = createWindow() })
  app.on('window-all-closed', () => app.quit())
}
