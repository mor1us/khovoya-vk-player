/** Ключ API от веб-версии ВК: берётся у login.vk.ru по cookie вошедшей сессии (как в Meridius/MuVK). */
export const WEB_TOKEN_APP_ID = 6287487
export const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0'
const REFRESH_MS = 5 * 60_000

export class SessionLostError extends Error { constructor() { super('Сессия ВК закончилась, войди снова') } }
export type WebToken = { token: string; userId: number; expires: number }

export function webTokenRequest(tld: 'ru' | 'com' = 'ru') {
  return {
    url: `https://login.vk.${tld}/?act=web_token`,
    body: new URLSearchParams({ version: '1', app_id: String(WEB_TOKEN_APP_ID) }).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: `https://id.vk.${tld}`, Referer: `https://id.vk.${tld}/`, Accept: '*/*', 'User-Agent': WEB_UA } as Record<string, string>
  }
}

export function parseWebToken(json: any): WebToken {
  if (!json || json.type !== 'okay' || !json.data?.access_token) throw new SessionLostError()
  const d = json.data
  const userId = Number(d.user_id ?? d.auth_info?.user?.id) || 0
  return { token: String(d.access_token), userId, expires: Number(d.expires) || 0 }
}

/** Держит свежий ключ: обновляет раз в 5 минут, по требованию и без дублей запросов. */
export class TokenKeeper {
  private cur: WebToken | null = null
  private at = 0
  private pending: Promise<WebToken | null> | null = null

  constructor(private fetchToken: () => Promise<WebToken>, private now: () => number = Date.now, private onLost: () => void = () => {}) {}

  invalidate() { this.at = -Infinity }
  set(t: WebToken) { this.cur = t; this.at = this.now() }
  clear() { this.cur = null; this.at = 0 }
  userId(): number { return this.cur?.userId ?? 0 }

  async get(): Promise<WebToken | null> {
    if (this.cur && this.now() - this.at < REFRESH_MS) return this.cur
    if (this.pending) return this.pending
    this.pending = (async () => {
      try {
        this.cur = await this.fetchToken(); this.at = this.now(); return this.cur
      } catch (e) {
        if (e instanceof SessionLostError) { this.cur = null; this.onLost(); return null }
        return this.cur // сеть упала — живём со старым ключом
      } finally { this.pending = null }
    })()
    return this.pending
  }
}

/** JS, который выполняется внутри страницы ВК: тот же запрос, что делает сам сайт. Возвращает текст ответа. */
export function webTokenScript(tld: 'ru' | 'com'): string {
  return `fetch('https://login.vk.${tld}/?act=web_token', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'version=1&app_id=${WEB_TOKEN_APP_ID}' }).then(r => r.text()).catch(e => 'ERR ' + e)`
}

/** Домен вошедшей страницы ВК (vk.com / m.vk.ru и т.п.), страницы входа не считаются. */
export function pageTld(url: string): 'ru' | 'com' | null {
  const m = /^https:\/\/(?:m\.)?vk\.(ru|com)(?:\/|$)/.exec(url)
  return m ? (m[1] as 'ru' | 'com') : null
}

/** Для журнала: ключи доступа никогда не пишем. */
export function redact(s: string): string {
  return s.replace(/("access_token"\s*:\s*")[^"]*/g, '$1***').replace(/(access_token=)[^&\s"]*/g, '$1***')
}
