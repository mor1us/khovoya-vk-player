import { KATE_CLIENT_ID } from './kate'
import { API_VERSION } from '../vk/client'

const REDIRECT = 'https://oauth.vk.com/blank.html'
// audio + offline + плейлисты/группы — как у Kate Mobile
const SCOPE = 'audio,offline,friends,groups,status,wall'

/** Вход в окне ВК (implicit flow): работает с кодом, SMS, QR — без отправки пароля приложению. */
export function authorizeUrl(): string {
  const q = new URLSearchParams({ client_id: KATE_CLIENT_ID, display: 'page', redirect_uri: REDIRECT, scope: SCOPE, response_type: 'token', revoke: '1', v: API_VERSION })
  return `https://oauth.vk.com/authorize?${q}`
}

export function parseRedirect(url: string): { token: string; userId: number } | { error: string } | null {
  if (!url.startsWith(REDIRECT)) return null
  const hash = url.split('#')[1]
  if (!hash) return null
  const p = new URLSearchParams(hash)
  if (p.get('access_token')) return { token: p.get('access_token')!, userId: Number(p.get('user_id')) || 0 }
  if (p.get('error')) return { error: p.get('error') === 'access_denied' ? 'Вход отменён' : 'ВК не дал войти. Попробуй ещё раз.' }
  return null
}
