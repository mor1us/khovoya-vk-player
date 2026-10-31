import type { Track } from '../../shared/types'

/**
 * SoundCloud без входа: публичный поиск и прослушивание через тот же API, что у сайта soundcloud.com.
 * client_id берём из скриптов сайта (как yt-dlp) и обновляем, если SoundCloud его сменил.
 */
export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }>

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

/** Лучший поток: обычный mp3, потом HLS mp3, потом HLS AAC. Зашифрованные и отрывки (30 с) не берём. */
export function pickTranscoding(r: any): Transcoding | null {
  const ts: Transcoding[] = (r?.media?.transcodings ?? []).filter((t: Transcoding) => t?.url && !t.snipped)
  const rank = (t: Transcoding) => {
    const p = t.format?.protocol, m = t.format?.mime_type ?? ''
    if (p === 'progressive') return 0
    if (p === 'hls' && /mpeg/.test(m)) return 1
    if (p === 'hls' && /mp4|aac/.test(m)) return 2
    return 9
  }
  const ok = ts.filter((t) => rank(t) < 9).sort((a, b) => rank(a) - rank(b))
  return ok[0] ?? null
}

export function artwork(r: any): string | undefined {
  const u: string | undefined = r?.artwork_url || r?.user?.avatar_url
  return u ? u.replace('-large.', '-t500x500.') : undefined
}

export function mapScTrack(r: any): Track | null {
  if (!r || r.kind !== 'track' || !r.id) return null
  const tr = pickTranscoding(r)
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
    link: r.permalink_url
  }
}

export class SoundCloud {
  private cid: string | null
  private cidJob: Promise<string> | null = null
  constructor(private fetch: Fetch, private store: { get(): string | null; set(v: string): void }, private log: (m: string) => void = () => {}) {
    this.cid = store.get()
  }

  private async text(url: string): Promise<string> {
    const r = await this.fetch(url, { headers: { 'User-Agent': SC_UA } })
    if (!r.ok) throw new Error(`SoundCloud ответил ${r.status}`)
    return r.text()
  }

  async clientId(force = false): Promise<string> {
    if (this.cid && !force) return this.cid
    this.cidJob ??= (async () => {
      const scripts = findScriptUrls(await this.text('https://soundcloud.com/')).reverse()
      for (const s of scripts) {
        const id = findClientId(await this.text(s).catch(() => ''))
        if (id) { this.cid = id; this.store.set(id); this.log('soundcloud: получен client_id'); return id }
      }
      throw new Error('SoundCloud недоступен: не нашёл ключ на сайте')
    })().finally(() => { this.cidJob = null })
    return this.cidJob
  }

  private async api(path: string, params: Record<string, string | number> = {}, retried = false): Promise<any> {
    const cid = await this.clientId()
    const u = new URL(path.startsWith('http') ? path : API + path)
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
    u.searchParams.set('client_id', cid)
    const r = await this.fetch(u.toString(), { headers: { 'User-Agent': SC_UA, Accept: 'application/json' } })
    if ((r.status === 401 || r.status === 403) && !retried) { await this.clientId(true); return this.api(path, params, true) }
    if (!r.ok) { this.log(`soundcloud: ${u.pathname} → ${r.status}`); throw new Error(`SoundCloud ответил ${r.status}`) }
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

  /** Ссылка на поток живёт недолго — получаем её прямо перед прослушиванием или скачиванием. */
  async streamUrl(t: Track): Promise<string> {
    let stream = t.scStream, auth = t.scAuth
    if (!stream) {
      const full = mapScTrack(await this.api(`/tracks/${t.vkId}`))
      stream = full?.scStream; auth = full?.scAuth
      if (!stream) throw new Error('Этот трек SoundCloud не даёт слушать')
    }
    const j = await this.api(stream, auth ? { track_authorization: auth } : {})
    if (!j?.url) throw new Error('SoundCloud не отдал ссылку на трек')
    return j.url
  }
}
