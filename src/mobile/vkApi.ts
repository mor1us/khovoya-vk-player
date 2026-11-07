import { VkClient } from '../main/vk/client'
import { VkAudioApi, type AudioApi } from '../main/vk/audio'
import { TokenKeeper, parseWebToken, webTokenRequest, SessionLostError } from '../main/auth/webToken'
import { VK_UA, API_VERSION } from '../main/vk/client'
import type { Session, Track } from '../shared/types'

export type VkDeps = {
  /** Запрос уходит через нативную сторону: только там можно поставить настоящий User-Agent. */
  fetch: typeof fetch
  onCaptcha(sid: string, imageDataUrl: string): Promise<string>
  onAuthLost(): void
  log(m: string): void
  /** Заголовок настоящего WebView телефона. Выдавать себя за десктопный браузер нельзя:
   *  ВК это видит, и вход по QR отваливается первым. */
  webUa?: () => string
}

/**
 * Весь ВК на телефоне. Ничего своего: `VkClient`, `VkAudioApi` и `TokenKeeper` — те же, что
 * на компьютере, меняется только `fetch` под ними и то, откуда берутся cookie.
 */
export function makeVkApi(deps: VkDeps): { api: AudioApi; keeper: TokenKeeper; session: () => Promise<Session> } {
  const fetchToken = async () => {
    const r = webTokenRequest('ru')
    const ua = deps.webUa?.()
    const headers = ua ? { ...r.headers, 'User-Agent': ua } : r.headers
    const res = await deps.fetch(r.url, { method: 'POST', body: r.body, headers })
    const text = await res.text()
    try { return parseWebToken(JSON.parse(text)) } catch {
      deps.log(`web_token: ${res.status} ${text.slice(0, 200)}`)
      throw new SessionLostError()
    }
  }

  const keeper = new TokenKeeper(fetchToken, Date.now, deps.onAuthLost)

  const client = new VkClient({
    token: async () => (await keeper.get())?.token ?? null,
    onTokenRejected: () => keeper.invalidate(),
    fetch: deps.fetch,
    onAuthLost: deps.onAuthLost,
    onCaptcha: deps.onCaptcha
  })

  const api = secure(new VkAudioApi(client, () => keeper.userId(), deps.log))

  const session = async (): Promise<Session> => {
    const t = await keeper.get()
    if (!t) return { loggedIn: false }
    const me = await userInfo(deps, t.token)
    return { loggedIn: true, userName: me.name, avatar: me.avatar, userId: t.userId }
  }

  return { api, keeper, session }
}

/**
 * WebView открыт по https и молча режет содержимое по http: трек бы просто не включился,
 * без объяснения. Поэтому все ссылки, что приходят от ВК, поднимаем до https.
 */
const up = (u?: string) => (u && u.startsWith('http://') ? 'https://' + u.slice(7) : u)

function secureTrack<T extends { url?: string; coverUrl?: string }>(t: T): T {
  return { ...t, url: up(t.url) ?? '', coverUrl: up(t.coverUrl) }
}

function secure(api: AudioApi): AudioApi {
  const list = (f: () => Promise<Track[]>) => async () => (await f()).map(secureTrack)
  return {
    ...api,
    myTracks: list(() => api.myTracks()),
    playlistTracks: (p) => api.playlistTracks(p).then((xs) => xs.map(secureTrack)),
    recommendations: (t, n) => api.recommendations(t, n).then((xs) => xs.map(secureTrack)),
    popular: () => api.popular().then((xs) => xs.map(secureTrack)),
    byId: (ids) => api.byId(ids).then((xs) => xs.map(secureTrack)),
    artistTracks: (a) => api.artistTracks(a).then((xs) => xs.map(secureTrack)),
    search: (q, o, d) => api.search(q, o, d).then((r) => ({ ...r, tracks: r.tracks.map(secureTrack) }))
  }
}

/** Имя и аватар для шапки. Не вышло — не беда, покажем «Ты». */
async function userInfo(deps: VkDeps, token: string): Promise<{ name: string; avatar?: string }> {
  try {
    const res = await deps.fetch(`https://api.vk.com/method/users.get?fields=photo_100&v=${API_VERSION}`, {
      method: 'POST',
      headers: { 'User-Agent': VK_UA, 'X-VK-Android-Client': 'new', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: token }).toString()
    })
    const j = (await res.json()) as { response?: { first_name?: string; last_name?: string; photo_100?: string }[] }
    const u = j.response?.[0]
    if (u) return { name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Ты', avatar: u.photo_100 }
  } catch (e) { deps.log(`users.get: ${(e as Error).message}`) }
  return { name: 'Ты' }
}
