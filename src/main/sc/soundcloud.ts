import type { Track } from '../../shared/types'

/**
 * SoundCloud без входа: публичный поиск и прослушивание через тот же API, что у сайта soundcloud.com.
 * client_id берём из скриптов сайта (как yt-dlp) и обновляем, если SoundCloud его сменил.
 */
export type Fetch = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }>

export const SC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const API = 'https://api-v2.soundcloud.com'

export function findScriptUrls(html: string): string[] {
  return [...html.matchAll(/<script[^>]+src="(https:\/\/[^"]*sndcdn\.com\/[^"]+\.js)"/g)].map((m) => m[1])
}

export function findClientId(js: string): string | null {
  const m = /client_id\s*[:=]\s*"([0-9a-zA-Z]{32})"/.exec(js) ?? /[?&]client_id=([0-9a-zA-Z]{32})/.exec(js)
  return m ? m[1] : null
}

type Transcoding = { url: string; snipped?: boolean; format?: { protocol?: string; mime_type?: string } }

/**
 * Потоки по порядку: обычный mp3, HLS AAC, HLS mp3. SoundCloud постепенно убирает mp3-потоки (отвечает 404),
 * поэтому пробуем по очереди. Зашифрованные и отрывки (30 с) не берём.
 */
export function pickTranscodings(r: any): Transcoding[] {
  const ts: Transcoding[] = (r?.media?.transcodings ?? []).filter((t: Transcoding) => t?.url && !t.snipped)
  const rank = (t: Transcoding) => {
    const p = t.format?.protocol, m = t.format?.mime_type ?? ''
    if (p === 'progressive') return 0
    if (p === 'hls' && /mp4|aac/.test(m)) return 1
    if (p === 'hls' && /mpeg/.test(m)) return 2
    return 9
  }
  return ts.filter((t) => rank(t) < 9).sort((a, b) => rank(a) - rank(b))
}
export const pickTranscoding = (r: any): Transcoding | null => pickTranscodings(r)[0] ?? null

export function artwork(r: any): string | undefined {
  const u: string | undefined = r?.artwork_url || r?.user?.avatar_url
  return u ? u.replace('-large.', '-t500x500.') : undefined
}

export function mapScTrack(r: any): Track | null {
  if (!r || r.kind !== 'track' || !r.id) return null
  const trs = pickTranscodings(r)
  const tr = trs[0]
  const blocked = r.policy === 'BLOCK' || r.policy === 'SNIP' || r.streamable === false
  return {
    id: `sc_${r.id}`,
    ownerId: 0,
    vkId: Number(r.id),
    title: String(r.title ?? '').trim() || 'Без названия',
    artist: String(r.publisher_metadata?.artist || r.user?.username || '').trim() || 'Неизвестен',
    duration: Math.round((Number(r.full_duration || r.duration) || 0) / 1000),
    url: '',
    coverUrl: artwork(r),
    addedAt: r.created_at ? Math.floor(Date.parse(r.created_at) / 1000) || undefined : undefined,
    available: !blocked && !!tr,
    src: 'sc',
    scAuth: r.track_authorization,
    scStream: tr?.url,
    scStreams: trs.map((x) => x.url),
    link: r.permalink_url,
    wave: r.waveform_url
  }
}

export const isScUrl = (s: string) => /^https?:\/\/(?:www\.|m\.|on\.)?soundcloud\.com\/\S+/i.test(s.trim())

export type ScResolved =
  | { kind: 'track'; track: Track }
  | { kind: 'playlist'; title: string; author: string; cover?: string; link?: string; tracks: Track[] }

/** Сжать рисунок громкости SoundCloud до n столбиков 0..1. */
export function bars(samples: number[], n: number, height = 140): number[] {
  if (!samples.length) return []
  const out: number[] = []
  const step = samples.length / n
  for (let i = 0; i < n; i++) {
    const from = Math.floor(i * step), to = Math.max(from + 1, Math.floor((i + 1) * step))
    let m = 0
    for (let j = from; j < to && j < samples.length; j++) m = Math.max(m, samples[j])
    out.push(m / height)
  }
  const top = Math.max(...out) || 1
  return out.map((v) => Math.max(0.08, Math.min(1, v / top)))
}

export type ScComment = { at: number; text: string; user: string; avatar?: string }

/** В России SoundCloud открывается только через VPN — говорим об этом прямо. */
export const SC_DOWN = 'SoundCloud недоступен. В России он открывается только через VPN — включи VPN и попробуй снова'
export const SC_NEED_KEY = 'Чтобы SoundCloud заработал без VPN, один раз включи VPN и открой вкладку SoundCloud — Хвоя запомнит ключ, дальше можно без VPN'
export const SC_KEY_OLD = 'Ключ SoundCloud устарел. Включи VPN на минуту и открой вкладку SoundCloud — Хвоя обновит ключ, потом снова можно без VPN'
export class ScUnavailable extends Error {}

/** Сайт, с которого берём ключ (в России закрыт), — в отличие от API и серверов с музыкой, которые могут работать. */
const SITES = ['https://soundcloud.com/', 'https://m.soundcloud.com/']

export type ScStatus = { ok: boolean; message?: string; hasKey: boolean }

/**
 * Ключ (client_id) берём с сайта один раз и храним на компе. Дальше поиск и музыка идут через API —
 * в России это может работать без VPN, даже когда сам сайт закрыт.
 */
export class SoundCloud {
  private cid: string | null
  private cidJob: Promise<string> | null = null
  /** Нет связи — минуту не стучимся на этот адрес, чтобы поиск и Волна ВК не ждали SoundCloud. */
  private down = new Map<string, number>()
  private keyProblem: 'none' | 'expired' | null = null
  private now: () => number
  private timeoutMs: number
  constructor(private fetch: Fetch, private store: { get(): string | null; set(v: string): void; at?(): number }, private log: (m: string) => void = () => {}, opts: { now?: () => number; timeoutMs?: number } = {}) {
    this.cid = store.get()
    this.now = opts.now ?? Date.now
    this.timeoutMs = opts.timeoutMs ?? 7000
  }

  status(): ScStatus {
    const hasKey = !!this.cid
    const siteDown = SITES.every((u) => this.isDown(new URL(u).host))
    if (this.keyProblem === 'none' || (!hasKey && siteDown)) return { ok: false, message: SC_NEED_KEY, hasKey }
    if (this.keyProblem === 'expired') return { ok: false, message: SC_KEY_OLD, hasKey }
    if (this.isDown(new URL(API).host)) return { ok: false, message: SC_DOWN, hasKey }
    return { ok: true, hasKey }
  }

  private isDown(host: string) { return this.now() < (this.down.get(host) ?? 0) }

  private markDown(host: string, why: string) {
    if (!this.isDown(host)) this.log(`soundcloud: ${host} недоступен — ${why}`)
    this.down.set(host, this.now() + 60_000)
  }

  /** Запрос с ограничением по времени: заблокированный адрес часто просто молчит. */
  private async get(url: string, headers: Record<string, string>) {
    const host = new URL(url).host
    if (this.isDown(host)) throw new ScUnavailable(SC_DOWN)
    const ac = new AbortController()
    const tm = setTimeout(() => ac.abort(), this.timeoutMs)
    try {
      const r = await this.fetch(url, { headers, signal: ac.signal })
      this.down.delete(host)
      return r
    } catch (e) {
      this.markDown(host, ac.signal.aborted ? `нет ответа за ${this.timeoutMs / 1000} с` : String((e as Error)?.message ?? e))
      throw new ScUnavailable(SC_DOWN)
    } finally { clearTimeout(tm) }
  }

  private async text(url: string): Promise<string> {
    const r = await this.get(url, { 'User-Agent': SC_UA })
    if (!r.ok) throw new Error(`SoundCloud ответил ${r.status}`)
    return r.text()
  }

  /** Достать свежий ключ с сайта (основного или мобильного). */
  private async fetchKey(): Promise<string> {
    let blocked = false
    for (const page of SITES) {
      try {
        const scripts = findScriptUrls(await this.text(page)).reverse()
        for (const s of scripts) {
          const id = findClientId(await this.text(s).catch((e) => { if (e instanceof ScUnavailable) throw e; return '' }))
          if (id) { this.cid = id; this.store.set(id); this.keyProblem = null; this.log('soundcloud: ключ получен и сохранён'); return id }
        }
      } catch (e) { if (e instanceof ScUnavailable) blocked = true }
    }
    if (blocked) throw new ScUnavailable(this.cid ? SC_KEY_OLD : SC_NEED_KEY)
    throw new Error('SoundCloud: не нашёл ключ на сайте')
  }

  async clientId(force = false): Promise<string> {
    if (this.cid && !force) return this.cid
    this.cidJob ??= this.fetchKey()
      .catch((e) => { if (e instanceof ScUnavailable) this.keyProblem = this.cid ? 'expired' : 'none'; throw e })
      .finally(() => { this.cidJob = null })
    return this.cidJob
  }

  /** Для вкладки SoundCloud: получить/обновить ключ, если сайт открывается, и проверить связь с API. */
  async prepare(): Promise<ScStatus> {
    if (!this.cid) await this.clientId().catch(() => {})
    else await this.refreshKey()
    if (this.cid) await this.suggest('a', 1).catch(() => {})
    return this.status()
  }

  /** Тихо обновить ключ, пока сайт открывается (например, с VPN), — чтобы потом дольше работать без VPN. */
  async refreshKey(maxAgeMs = 12 * 3600_000): Promise<void> {
    const at = this.store.at?.() ?? 0
    if (this.cid && at && this.now() - at < maxAgeMs) return
    await this.fetchKey().catch(() => {})
  }

  private async api(path: string, params: Record<string, string | number> = {}, retried = false): Promise<any> {
    const cid = await this.clientId()
    const u = new URL(path.startsWith('http') ? path : API + path)
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
    u.searchParams.set('client_id', cid)
    const r = await this.get(u.toString(), { 'User-Agent': SC_UA, Accept: 'application/json' })
    if ((r.status === 401 || r.status === 403) && !retried) { await this.clientId(true); return this.api(path, params, true) }
    if ((r.status === 403 || r.status === 451) && retried) { this.markDown(new URL(API).host, `ответ ${r.status} — похоже, доступ из этой страны закрыт`); throw new ScUnavailable(SC_DOWN) }
    if (!r.ok) { this.log(`soundcloud: ${u.pathname} → ${r.status}`); throw new Error(`SoundCloud ответил ${r.status}`) }
    this.keyProblem = null
    return r.json()
  }

  async search(q: string, limit = 40): Promise<Track[]> {
    const j = await this.api('/search/tracks', { q, limit, offset: 0, linked_partitioning: 1 })
    return (j?.collection ?? []).map(mapScTrack).filter((t: Track | null): t is Track => !!t)
  }

  async related(t: Track, limit = 30): Promise<Track[]> {
    const j = await this.api(`/tracks/${t.vkId}/related`, { limit })
    return (j?.collection ?? []).map(mapScTrack).filter((x: Track | null): x is Track => !!x)
  }

  /** Варианты запроса, пока человек печатает. */
  async suggest(q: string, limit = 8): Promise<string[]> {
    const j = await this.api('/search/queries', { q, limit })
    return [...new Set<string>((j?.collection ?? []).map((x: any) => String(x?.output || x?.query || '').trim()).filter(Boolean))]
  }

  /** Артисты SoundCloud по запросу (для подсказок). */
  async users(q: string, limit = 4): Promise<{ name: string; avatar?: string; link?: string; followers: number }[]> {
    const j = await this.api('/search/users', { q, limit })
    return (j?.collection ?? []).filter((u: any) => u?.username).map((u: any) => ({
      name: String(u.username), avatar: u.avatar_url ? String(u.avatar_url).replace('-large.', '-t200x200.') : undefined, link: u.permalink_url, followers: Number(u.followers_count) || 0
    }))
  }

  /** Трек или плейлист по ссылке с soundcloud.com. */
  async resolve(url: string): Promise<ScResolved> {
    const r = await this.api('/resolve', { url: url.trim() })
    if (r?.kind === 'track') { const t = mapScTrack(r); if (!t) throw new Error('Не получилось открыть трек'); return { kind: 'track', track: t } }
    if (r?.kind === 'playlist' || r?.kind === 'system-playlist') {
      const raw: any[] = r.tracks ?? []
      const full = new Map<number, any>(raw.filter((x) => x?.title).map((x) => [x.id, x]))
      const missing = raw.filter((x) => !x?.title).map((x) => x.id)
      for (let i = 0; i < missing.length; i += 50) { // SoundCloud отдаёт плейлист не целиком — дозапрашиваем треки пачками
        const part = await this.api('/tracks', { ids: missing.slice(i, i + 50).join(',') }).catch(() => [])
        for (const x of Array.isArray(part) ? part : []) full.set(x.id, x)
      }
      const tracks = raw.map((x) => mapScTrack(full.get(x.id) ?? x)).filter((t): t is Track => !!t)
      return { kind: 'playlist', title: String(r.title ?? 'Плейлист SoundCloud'), author: String(r.user?.username ?? ''), cover: artwork(r) ?? tracks[0]?.coverUrl, link: r.permalink_url, tracks }
    }
    throw new Error('По этой ссылке нет ни трека, ни плейлиста')
  }

  /** Настоящий рисунок громкости трека (столбики 0..1). */
  async waveform(t: Track, n = 70): Promise<number[]> {
    if (!t.wave) return []
    const url = t.wave.replace(/\.png(\?.*)?$/, '.json')
    const r = await this.get(url, { 'User-Agent': SC_UA })
    if (!r.ok) return []
    const j = await r.json()
    return bars(Array.isArray(j?.samples) ? j.samples : [], n, Number(j?.height) || 140)
  }

  /** Комментарии по ходу трека (секунда → текст). */
  async comments(t: Track): Promise<ScComment[]> {
    const j = await this.api(`/tracks/${t.vkId}/comments`, { threaded: 0, filter_replies: 0, limit: 200, offset: 0 })
    return (j?.collection ?? [])
      .filter((c: any) => typeof c?.timestamp === 'number' && c?.body)
      .map((c: any) => ({ at: c.timestamp / 1000, text: String(c.body).slice(0, 140), user: String(c.user?.username ?? ''), avatar: c.user?.avatar_url }))
      .sort((a: ScComment, b: ScComment) => a.at - b.at)
  }

  /** Ссылка на поток живёт недолго — получаем её прямо перед прослушиванием или скачиванием. */
  async streamUrl(t: Track): Promise<string> {
    const tried = new Set<string>()
    const attempt = async (list: string[], auth?: string) => {
      for (const s of list) {
        if (tried.has(s)) continue
        tried.add(s)
        try {
          const j = await this.api(s, auth ? { track_authorization: auth } : {})
          if (j?.url) return String(j.url)
        } catch (e) { if (e instanceof ScUnavailable) throw e } // 404 у этого формата — пробуем следующий
      }
      return ''
    }
    const first = await attempt(t.scStreams?.length ? t.scStreams : t.scStream ? [t.scStream] : [], t.scAuth)
    if (first) return first
    // сохранённые ссылки устарели (или трек из старой версии) — берём свежие данные трека
    const full = mapScTrack(await this.api(`/tracks/${t.vkId}`))
    const again = full ? await attempt(full.scStreams ?? [], full.scAuth) : ''
    if (again) return again
    throw new Error('SoundCloud не отдал этот трек')
  }
}
