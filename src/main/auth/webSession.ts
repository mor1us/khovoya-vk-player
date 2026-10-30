import { BrowserWindow, session, type Session } from 'electron'
import { parseWebToken, webTokenRequest, WEB_UA, SessionLostError, type WebToken } from './webToken'
import { VK_UA, API_VERSION } from '../vk/client'

/** Вход на обычном сайте ВК. Cookie живут в отдельном разделе (на Windows шифруются системой). */
export const vkSession = (): Session => session.fromPartition('persist:vk')

let warmed = false
async function warmUp(s: Session) {
  if (warmed) return
  try { await s.fetch('https://vk.ru/', { headers: { 'User-Agent': WEB_UA } }); warmed = true } catch { /* не страшно */ }
}

async function tokenFrom(s: Session, tld: 'ru' | 'com'): Promise<WebToken> {
  const r = webTokenRequest(tld)
  const res = await s.fetch(r.url, { method: 'POST', body: r.body, headers: r.headers })
  let json: unknown = null
  try { json = await res.json() } catch { throw new SessionLostError() }
  return parseWebToken(json)
}

/** Ключ от веб-версии ВК: сначала vk.ru, если сессия на vk.com — оттуда. */
export async function fetchWebToken(): Promise<WebToken> {
  const s = vkSession()
  await warmUp(s)
  try { return await tokenFrom(s, 'ru') } catch (e) {
    if (!(e instanceof SessionLostError)) throw e
    return tokenFrom(s, 'com')
  }
}

export async function userInfo(token: string): Promise<{ name: string; avatar?: string; id?: number }> {
  try {
    const r = await fetch(`https://api.vk.com/method/users.get?fields=photo_100&v=${API_VERSION}`, {
      method: 'POST', headers: { 'User-Agent': VK_UA, 'X-VK-Android-Client': 'new', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: token }).toString()
    })
    const u = ((await r.json()) as any).response?.[0]
    if (u) return { name: `${u.first_name} ${u.last_name}`.trim(), avatar: u.photo_100, id: u.id }
  } catch { /* имя не обязательно */ }
  return { name: 'Ты' }
}

/** Окно с сайтом ВК: входи как угодно (QR, код, пароль). Как только сайт отдаёт ключ — готово. */
export function loginWindow(parent: BrowserWindow | null): Promise<WebToken | { error: string }> {
  return new Promise((resolve) => {
    const s = vkSession()
    s.setUserAgent(WEB_UA)
    const w = new BrowserWindow({
      width: 980, height: 760, parent: parent ?? undefined, modal: !!parent, title: 'Вход в ВКонтакте', autoHideMenuBar: true, backgroundColor: '#ffffff',
      webPreferences: { session: s, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    let done = false, checking = false
    const finish = (r: WebToken | { error: string }) => { if (done) return; done = true; if (!w.isDestroyed()) w.close(); resolve(r) }
    const tryToken = async (url: string) => {
      if (done || checking || !/^https:\/\/(m\.)?vk\.(ru|com)\//.test(url) || /\/(login|auth)/.test(url)) return
      checking = true
      try { warmed = false; finish(await fetchWebToken()) } catch { /* ещё не вошёл */ } finally { checking = false }
    }
    w.webContents.on('did-navigate', (_e, url) => void tryToken(url))
    w.webContents.on('did-navigate-in-page', (_e, url) => void tryToken(url))
    w.webContents.setWindowOpenHandler(({ url }) => { void w.loadURL(url); return { action: 'deny' } })
    w.on('closed', () => { if (!done) { done = true; resolve({ error: 'Окно входа закрыто' }) } })
    void w.loadURL('https://vk.ru/', { userAgent: WEB_UA })
  })
}

export async function logoutVk() {
  warmed = false
  await vkSession().clearStorageData()
}
