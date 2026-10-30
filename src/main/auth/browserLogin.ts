import { KATE_CLIENT_ID } from './kate'

const REDIRECT = 'https://oauth.vk.com/blank.html'
const BLANKS = ['https://oauth.vk.com/blank.html', 'https://api.vk.com/blank.html']
// Полный набор прав Kate Mobile (так же, как у vkhost.github.io)
const SCOPE = '1073737727'

/** Обычный Chrome: ВК не пускает вход во «встроенных» браузерах с подписью Electron. */
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/** Вход в окне ВК (implicit flow): код, SMS, QR — пароль приложению не передаётся. */
export function authorizeUrl(): string {
  const q = new URLSearchParams({ client_id: KATE_CLIENT_ID, scope: SCOPE, redirect_uri: REDIRECT, display: 'page', response_type: 'token', revoke: '1' })
  return `https://oauth.vk.com/authorize?${q}`
}

function fromParams(p: URLSearchParams): { token: string; userId: number } | { error: string } | null {
  if (p.get('access_token')) return { token: p.get('access_token')!, userId: Number(p.get('user_id')) || 0 }
  if (p.get('error')) return { error: p.get('error') === 'access_denied' ? 'Вход отменён' : 'ВК не дал войти. Попробуй ещё раз.' }
  return null
}

export function parseRedirect(url: string): { token: string; userId: number } | { error: string } | null {
  if (!BLANKS.some((b) => url.startsWith(b))) return null
  const hash = url.split('#')[1]
  return hash ? fromParams(new URLSearchParams(hash)) : null
}

/** Ссылка или ключ, вставленные вручную после входа в обычном браузере. */
export function parseManual(text: string): { token: string; userId: number } | null {
  const t = text.trim()
  if (!t) return null
  const part = t.includes('#') ? t.split('#')[1] : t.includes('access_token=') ? t.slice(t.indexOf('access_token=')) : null
  if (part) { const r = fromParams(new URLSearchParams(part)); return r && 'token' in r ? r : null }
  if (/^[A-Za-z0-9._-]{60,}$/.test(t)) return { token: t, userId: 0 }
  return null
}
