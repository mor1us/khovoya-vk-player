import { registerPlugin } from '@capacitor/core'
import { parseWebToken, webTokenScript, SessionLostError, type WebToken } from '../main/auth/webToken'

type Khvoya = {
  request(o: { url: string; method: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; body: string }>
  login(o: { url: string; script: string }): Promise<{ body?: string; error?: string }>
  userAgent(): Promise<{ value: string }>
  logout(): Promise<void>
  playback(o: { on: boolean }): Promise<void>
}

const native = registerPlugin<Khvoya>('Khvoya')

/**
 * `fetch`, который на самом деле уходит из Kotlin. Нужен из-за двух запретов WebView:
 * нельзя задать `User-Agent` (а `audio.*` ВК отдаёт только официальному приложению)
 * и нельзя сходить на `api.vk.com` из-за CORS.
 */
export const nativeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const headers: Record<string, string> = {}
  const h = init?.headers
  if (h instanceof Headers) h.forEach((v, k) => { headers[k] = v })
  else if (Array.isArray(h)) for (const [k, v] of h) headers[k] = v
  else if (h) Object.assign(headers, h)

  const r = await native.request({ url, method: init?.method ?? 'GET', headers, body: init?.body ? String(init.body) : undefined })
  return new Response(r.body, { status: r.status })
}

/** Заголовок настоящего WebView. Им же ходим за ключом — иначе ВК видит расхождение. */
export async function webUserAgent(): Promise<string> {
  try { return (await native.userAgent()).value } catch { return '' }
}

/** Экран входа: настоящий сайт ВК. Ключ забираем тем же скриптом, что и компьютерная Хвоя. */
export async function login(): Promise<WebToken> {
  const r = await native.login({ url: 'https://vk.com/', script: webTokenScript('ru') })
  if (r.error) throw new Error(r.error)
  try { return parseWebToken(JSON.parse(r.body ?? '')) } catch { throw new SessionLostError() }
}

export const logout = () => native.logout()
/** Служба держит процесс живым, пока идёт звук. */
export const playback = (on: boolean) => native.playback({ on }).catch(() => { /* не критично */ })
