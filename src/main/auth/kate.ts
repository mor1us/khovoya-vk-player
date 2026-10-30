import type { LoginInput, LoginStep } from '../../shared/types'
import { KATE_UA, API_VERSION } from '../vk/client'

export const KATE_CLIENT_ID = '2685278'
const KATE_SECRET = 'lxhD8OD7dMsqtXIm5IUY'

export type StoredSession = { token: string; userId: number }
export interface SessionStore { save(s: StoredSession): void; load(): StoredSession | null; clear(): void }

export async function fetchImageDataUrl(f: typeof fetch, url: string): Promise<string> {
  const r = await f(url, { headers: { 'User-Agent': KATE_UA } })
  const type = r.headers.get('content-type') || 'image/jpeg'
  const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
  return `data:${type.startsWith('image/') ? type : 'image/jpeg'};base64,${b64}`
}

export async function login(input: LoginInput, deps: { fetch: typeof fetch; store: SessionStore }): Promise<LoginStep> {
  const q = new URLSearchParams({
    grant_type: 'password', client_id: KATE_CLIENT_ID, client_secret: KATE_SECRET,
    username: input.username, password: input.password, v: API_VERSION, '2fa_supported': '1', scope: 'all'
  })
  if (input.code) q.set('code', input.code)
  if (input.captchaSid) { q.set('captcha_sid', input.captchaSid); q.set('captcha_key', input.captchaKey ?? '') }
  let json: any
  try {
    const r = await deps.fetch(`https://oauth.vk.com/token?${q}`, { headers: { 'User-Agent': KATE_UA } })
    json = await r.json()
  } catch {
    return { kind: 'error', message: 'Нет подключения к ВК. Проверь интернет.' }
  }
  if (json.access_token) {
    deps.store.save({ token: json.access_token, userId: json.user_id })
    const me = await userInfo(deps.fetch, json.access_token)
    return { kind: 'ok', userName: me.name, avatar: me.avatar }
  }
  switch (json.error) {
    case 'need_validation':
      return { kind: '2fa', phoneMask: json.phone_mask, validationSid: json.validation_sid }
    case 'need_captcha':
      try { return { kind: 'captcha', sid: String(json.captcha_sid), imageDataUrl: await fetchImageDataUrl(deps.fetch, json.captcha_img) } }
      catch { return { kind: 'error', message: 'Не удалось загрузить картинку капчи. Попробуй ещё раз.' } }
    case 'invalid_client':
    case 'invalid_request':
      if (/too many attempts|different sign-in method/i.test(json.error_description ?? '')) return { kind: 'error', message: friendlyVkError(json.error_description) }
      if (input.code && /code|wrong/i.test(json.error_description ?? '')) return { kind: 'error', message: 'Неверный код подтверждения' }
      return { kind: 'error', message: 'Неверный логин или пароль' }
    case 'need_password': return { kind: 'error', message: 'Нужен пароль' }
    default:
      return { kind: 'error', message: json.error_description ? friendlyVkError(json.error_description) : 'Не удалось войти. Попробуй позже.' }
  }
}

export async function userInfo(f: typeof fetch, token: string): Promise<{ name: string; avatar?: string; id?: number }> {
  try {
    const r = await f(`https://api.vk.com/method/users.get?fields=photo_100&v=${API_VERSION}&access_token=${encodeURIComponent(token)}`, { headers: { 'User-Agent': KATE_UA } })
    const u = ((await r.json()) as any).response?.[0]
    if (u) return { name: `${u.first_name} ${u.last_name}`.trim(), avatar: u.photo_100, id: u.id }
  } catch { /* имя не обязательно */ }
  return { name: 'Ты' }
}

export function friendlyVkError(desc: string): string {
  if (/too many attempts|different sign-in method/i.test(desc)) return 'ВК временно запретил вход по паролю (слишком много попыток). Нажми «Войти через окно ВК» — там можно войти по коду или QR.'
  if (/flood|too many requests/i.test(desc)) return 'Слишком много попыток входа. Подожди немного и попробуй снова.'
  return `ВК не пустил: ${desc}`
}
