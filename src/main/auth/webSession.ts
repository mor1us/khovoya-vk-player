import { app, BrowserWindow, session, type Session } from 'electron'
import { join } from 'path'
import { appendFileSync, statSync, renameSync } from 'fs'
import { parseWebToken, webTokenRequest, webTokenScript, pageTld, redact, WEB_UA, SessionLostError, type WebToken } from './webToken'
import { VK_UA, API_VERSION } from '../vk/client'

/** Вход на обычном сайте ВК. Cookie живут в отдельном разделе (на Windows шифруются системой). */
export const vkSession = (): Session => session.fromPartition('persist:vk')

/** Журнал входа: %APPDATA%/Хвоя/khvoya.log. Ключи не пишутся. */
export function log(msg: string) {
  try {
    const f = join(app.getPath('userData'), 'khvoya.log')
    try { if (statSync(f).size > 1_000_000) renameSync(f, f + '.old') } catch { /* нет файла */ }
    appendFileSync(f, `${new Date().toISOString()} ${redact(msg).slice(0, 600)}\n`)
  } catch { /* журнал не обязателен */ }
}

async function tokenInPage(w: BrowserWindow, tld: 'ru' | 'com'): Promise<WebToken> {
  const text = String(await w.webContents.executeJavaScript(webTokenScript(tld), true))
  let json: unknown
  try { json = JSON.parse(text) } catch { log(`web_token(${tld}) в странице: не JSON: ${text.slice(0, 200)}`); throw new SessionLostError() }
  try { return parseWebToken(json) } catch (e) { log(`web_token(${tld}) в странице: отказ: ${text.slice(0, 300)}`); throw e }
}

/** Скрытое окно на домене ВК, из которого делаем тот же запрос, что и сайт. */
async function tokenViaHiddenPage(tld: 'ru' | 'com'): Promise<WebToken> {
  const w = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { session: vkSession(), contextIsolation: true, sandbox: true, backgroundThrottling: false } })
  try {
    await w.loadURL(`https://vk.${tld}/robots.txt`, { userAgent: WEB_UA })
    return await tokenInPage(w, tld)
  } finally { if (!w.isDestroyed()) w.destroy() }
}

async function tokenViaNet(tld: 'ru' | 'com'): Promise<WebToken> {
  const r = webTokenRequest(tld)
  const res = await vkSession().fetch(r.url, { method: 'POST', body: r.body, headers: r.headers })
  const text = await res.text()
  try { return parseWebToken(JSON.parse(text)) } catch { log(`web_token(${tld}) net: ${res.status} ${text.slice(0, 300)}`); throw new SessionLostError() }
}

/** Ключ от веб-версии ВК. Пробуем по очереди; сессия потеряна, только если отказали все способы. */
let lastTld: 'ru' | 'com' = 'ru'
export async function fetchWebToken(): Promise<WebToken> {
  let netError: unknown = null
  const other = lastTld === 'ru' ? 'com' : 'ru'
  const attempts: [() => Promise<WebToken>, 'ru' | 'com'][] = [[() => tokenViaHiddenPage(lastTld), lastTld], [() => tokenViaHiddenPage(other), other], [() => tokenViaNet(lastTld), lastTld], [() => tokenViaNet(other), other]]
  for (const [attempt, tld] of attempts) {
    try { const t = await attempt(); lastTld = tld; return t } catch (e) {
      if (!(e instanceof SessionLostError)) { netError = e; log(`ошибка получения ключа: ${(e as Error).message}`) }
    }
  }
  if (netError) throw netError
  throw new SessionLostError()
}

export async function userInfo(token: string): Promise<{ name: string; avatar?: string; id?: number }> {
  try {
    const r = await fetch(`https://api.vk.com/method/users.get?fields=photo_100&v=${API_VERSION}`, {
      method: 'POST', headers: { 'User-Agent': VK_UA, 'X-VK-Android-Client': 'new', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: token }).toString()
    })
    const j = (await r.json()) as any
    const u = j.response?.[0]
    if (u) return { name: `${u.first_name} ${u.last_name}`.trim(), avatar: u.photo_100, id: u.id }
    log(`users.get: ${JSON.stringify(j).slice(0, 300)}`)
  } catch (e) { log(`users.get ошибка: ${(e as Error).message}`) }
  return { name: 'Ты' }
}

/** Окно с сайтом ВК: входи как угодно (QR, код, пароль). Как только страница ВК отдаёт ключ — окно закрывается. */
export function loginWindow(parent: BrowserWindow | null): Promise<WebToken | { error: string }> {
  return new Promise((resolve) => {
    const s = vkSession()
    s.setUserAgent(WEB_UA)
    const w = new BrowserWindow({
      width: 1000, height: 780, parent: parent ?? undefined, modal: !!parent, title: 'Вход в ВКонтакте', autoHideMenuBar: true, backgroundColor: '#ffffff',
      webPreferences: { session: s, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    let done = false, checking = false
    const timer = setInterval(() => void tryToken('poll'), 2000)
    const finish = (r: WebToken | { error: string }) => {
      if (done) return
      done = true; clearInterval(timer)
      if (!w.isDestroyed()) w.close()
      resolve(r)
    }
    const tryToken = async (why: string) => {
      if (done || checking || w.isDestroyed()) return
      const url = w.webContents.getURL()
      const tld = pageTld(url)
      if (!tld) return
      checking = true
      try { const t = await tokenInPage(w, tld); log(`вход: ключ получен (${why}, ${url.split('?')[0]})`); finish(t) }
      catch { /* ещё не вошёл — проверим позже */ }
      finally { checking = false }
    }
    w.webContents.on('did-finish-load', () => void tryToken('load'))
    w.webContents.on('did-navigate-in-page', () => void tryToken('spa'))
    w.webContents.setWindowOpenHandler(({ url }) => { void w.loadURL(url); return { action: 'deny' } })
    w.on('closed', () => { clearInterval(timer); if (!done) { done = true; log('вход: окно закрыто пользователем'); resolve({ error: 'Окно входа закрыто' }) } })
    log('вход: открываю vk.com')
    void w.loadURL('https://vk.com/', { userAgent: WEB_UA })
  })
}

export async function logoutVk() {
  log('выход из ВК')
  await vkSession().clearStorageData()
}
