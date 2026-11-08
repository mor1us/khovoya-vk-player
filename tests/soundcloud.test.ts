import { describe, it, expect } from 'vitest'
import { SoundCloud, findClientId, findScriptUrls, mapScTrack, pickTranscodings, type Fetch } from '../src/main/sc/soundcloud'

const pickTranscoding = (r: unknown) => pickTranscodings(r)[0] ?? null

const CID = 'a'.repeat(16) + 'B'.repeat(16)
const raw = (over: any = {}) => ({
  kind: 'track', id: 42, title: 'Night Drive', duration: 180000, full_duration: 180000, policy: 'ALLOW', streamable: true,
  user: { username: 'synthboy', avatar_url: 'https://i1.sndcdn.com/avatars-x-large.jpg' }, artwork_url: 'https://i1.sndcdn.com/artworks-y-large.jpg',
  track_authorization: 'AUTH', permalink_url: 'https://soundcloud.com/synthboy/night-drive', created_at: '2026-10-01T10:00:00Z',
  media: { transcodings: [
    { url: 'https://api-v2.soundcloud.com/media/hls-aac', format: { protocol: 'hls', mime_type: 'audio/mp4; codecs="mp4a.40.2"' } },
    { url: 'https://api-v2.soundcloud.com/media/hls-mp3', format: { protocol: 'hls', mime_type: 'audio/mpeg' } },
    { url: 'https://api-v2.soundcloud.com/media/enc', format: { protocol: 'encrypted-hls', mime_type: 'audio/mp4' } }
  ] },
  ...over
})

const res = (status: number, body: unknown) => ({ ok: status < 400, status, text: async () => String(body), json: async () => body })

describe('SoundCloud', () => {
  it('находит скрипты сайта и client_id', () => {
    expect(findScriptUrls('<script crossorigin src="https://a-v2.sndcdn.com/assets/0-abc.js"></script><script src="https://a-v2.sndcdn.com/assets/50-def.js"></script>'))
      .toEqual(['https://a-v2.sndcdn.com/assets/0-abc.js', 'https://a-v2.sndcdn.com/assets/50-def.js'])
    expect(findClientId(`foo({client_id:"${CID}",env:"prod"})`)).toBe(CID)
    expect(findClientId('nothing here')).toBeNull()
  })

  it('порядок потоков: AAC, потом mp3; зашифрованный не берём', () => {
    expect(pickTranscoding(raw())?.url).toBe('https://api-v2.soundcloud.com/media/hls-aac')
    expect(mapScTrack(raw())!.scStreams).toEqual(['https://api-v2.soundcloud.com/media/hls-aac', 'https://api-v2.soundcloud.com/media/hls-mp3'])
    expect(pickTranscoding(raw({ media: { transcodings: [{ url: 'p', format: { protocol: 'progressive', mime_type: 'audio/mpeg' } }, { url: 'h', format: { protocol: 'hls', mime_type: 'audio/mpeg' } }] } }))?.url).toBe('p')
    expect(pickTranscoding(raw({ media: { transcodings: [{ url: 's', snipped: true, format: { protocol: 'hls', mime_type: 'audio/mpeg' } }] } }))).toBeNull()
  })

  it('превращает трек SoundCloud в трек плеера', () => {
    const t = mapScTrack(raw())!
    expect(t).toMatchObject({ id: 'sc_42', src: 'sc', title: 'Night Drive', artist: 'synthboy', duration: 180, available: true, scAuth: 'AUTH' })
    expect(t.coverUrl).toBe('https://i1.sndcdn.com/artworks-y-t500x500.jpg')
    expect(mapScTrack(raw({ policy: 'SNIP' }))!.available).toBe(false)
    expect(mapScTrack({ kind: 'playlist', id: 1 })).toBeNull()
  })

  it('ищет и обновляет client_id, если старый перестал работать', async () => {
    const calls: string[] = []
    let stored: string | null = 'OLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOL'
    const f: Fetch = async (url) => {
      calls.push(url)
      if (url === 'https://soundcloud.com/') return res(200, '<script src="https://a-v2.sndcdn.com/assets/1-x.js"></script>')
      if (url.endsWith('1-x.js')) return res(200, `client_id:"${CID}"`)
      if (url.includes('client_id=OLD')) return res(401, {})
      return res(200, { collection: [raw(), { kind: 'user', id: 7 }] })
    }
    const sc = new SoundCloud(f, { get: () => stored, set: (v) => { stored = v } })
    const r = await sc.search('night')
    expect(r.map((t) => t.id)).toEqual(['sc_42'])
    expect(stored).toBe(CID)
    expect(calls.filter((u) => u.includes('/search/tracks'))).toHaveLength(2)
  })

  it('получает ссылку на поток с track_authorization', async () => {
    let asked = ''
    const f: Fetch = async (url) => { asked = url; return res(200, { url: 'https://cf-hls-media.sndcdn.com/playlist.m3u8' }) }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    expect(await sc.streamUrl(mapScTrack(raw())!)).toBe('https://cf-hls-media.sndcdn.com/playlist.m3u8')
    expect(asked).toContain('track_authorization=AUTH')
    expect(asked).toContain('client_id=' + CID)
  })
})

import { bars, isScUrl } from '../src/main/sc/soundcloud'
describe('SoundCloud: ссылки, волна звука, комментарии', () => {
  it('узнаёт ссылки SoundCloud', () => {
    expect(isScUrl('https://soundcloud.com/synthboy/sets/night')).toBe(true)
    expect(isScUrl('https://on.soundcloud.com/AbCd')).toBe(true)
    expect(isScUrl('кишлак')).toBe(false)
  })
  it('сжимает рисунок громкости до нужного числа столбиков', () => {
    const b = bars([10, 20, 140, 70, 35, 0], 3)
    expect(b).toHaveLength(3)
    expect(Math.max(...b)).toBe(1)
    expect(b.every((x) => x >= 0.08 && x <= 1)).toBe(true)
  })
  it('дозапрашивает неполные треки плейлиста', async () => {
    const asked: string[] = []
    const f: Fetch = async (url) => {
      asked.push(url)
      if (url.includes('/resolve')) return res(200, { kind: 'playlist', title: 'Night', user: { username: 'dj' }, tracks: [raw({ id: 1 }), { id: 2 }, { id: 3 }] })
      if (url.includes('/tracks?')) return res(200, [raw({ id: 2, title: 'Two' }), raw({ id: 3, title: 'Three' })])
      return res(404, {})
    }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    const r = await sc.resolve('https://soundcloud.com/dj/sets/night')
    expect(r.kind).toBe('playlist')
    if (r.kind === 'playlist') expect(r.tracks.map((t) => t.title)).toEqual(['Night Drive', 'Two', 'Three'])
    expect(asked.some((u) => u.includes('ids=2%2C3') || u.includes('ids=2,3'))).toBe(true)
  })
  it('комментарии сортируются по времени', async () => {
    const f: Fetch = async () => res(200, { collection: [{ timestamp: 9000, body: 'b', user: { username: 'u2' } }, { timestamp: 3000, body: 'a', user: { username: 'u1' } }, { timestamp: null, body: 'x' }] })
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    expect((await sc.comments(mapScTrack(raw())!)).map((c) => c.at)).toEqual([3, 9])
  })
})

import { SC_DOWN } from '../src/main/sc/soundcloud'
describe('SoundCloud недоступен (Россия без VPN)', () => {
  it('нет связи — понятная ошибка про VPN и минуту не стучимся', async () => {
    let calls = 0, t = 1000
    const f: Fetch = async () => { calls++; throw new Error('net::ERR_CONNECTION_RESET') }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} }, () => {}, { now: () => t })
    await expect(sc.search('x')).rejects.toThrow(SC_DOWN)
    expect(sc.status().ok).toBe(false)
    await expect(sc.search('y')).rejects.toThrow(SC_DOWN)
    expect(calls).toBe(1) // второй раз даже не пытались
    t += 61_000
    await expect(sc.search('z')).rejects.toThrow(SC_DOWN)
    expect(calls).toBe(2)
  })
  it('сайт молчит — обрываем по таймауту', async () => {
    const f: Fetch = (_u, init) => new Promise((_, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))))
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} }, () => {}, { timeoutMs: 30 })
    await expect(sc.search('x')).rejects.toThrow(SC_DOWN)
  })
  it('стабильный 403 после обновления ключа — тоже «включи VPN»', async () => {
    const f: Fetch = async (url) => (url === 'https://soundcloud.com/' ? res(200, '<script src="https://a-v2.sndcdn.com/assets/1-x.js"></script>') : url.endsWith('1-x.js') ? res(200, `client_id:"${CID}"`) : res(403, {}))
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    await expect(sc.search('x')).rejects.toThrow(SC_DOWN)
    expect(sc.status().ok).toBe(false)
  })
  it('связь вернулась — снова работает', async () => {
    let up = false, t = 0
    const f: Fetch = async () => { if (!up) throw new Error('reset'); return res(200, { collection: [raw()] }) }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} }, () => {}, { now: () => t })
    await expect(sc.search('x')).rejects.toThrow()
    up = true; t += 61_000
    expect(await sc.search('x')).toHaveLength(1)
    expect(sc.status().ok).toBe(true)
  })
})

import { SC_NEED_KEY, SC_KEY_OLD } from '../src/main/sc/soundcloud'
describe('VPN один раз — дальше без него', () => {
  const siteBlocked: Fetch = async (url) => {
    if (/^https:\/\/(m\.)?soundcloud\.com\//.test(url)) throw new Error('ERR_CONNECTION_RESET')
    return res(200, { collection: [raw()] })
  }
  it('сайт закрыт, но с сохранённым ключом поиск работает', async () => {
    const sc = new SoundCloud(siteBlocked, { get: () => CID, set: () => {} })
    expect(await sc.search('x')).toHaveLength(1)
    expect(sc.status()).toEqual({ ok: true, hasKey: true })
  })
  it('ключа нет и сайт закрыт — просим один раз включить VPN', async () => {
    const sc = new SoundCloud(siteBlocked, { get: () => null, set: () => {} })
    await expect(sc.search('x')).rejects.toThrow(SC_NEED_KEY)
    expect(sc.status()).toMatchObject({ ok: false, message: SC_NEED_KEY, hasKey: false })
  })
  it('ключ устарел, а сайт закрыт — просим VPN на минуту', async () => {
    const f: Fetch = async (url) => (/^https:\/\/(m\.)?soundcloud\.com\//.test(url) ? Promise.reject(new Error('reset')) : res(401, {}))
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    await expect(sc.search('x')).rejects.toThrow(SC_KEY_OLD)
    expect(sc.status()).toMatchObject({ ok: false, message: SC_KEY_OLD, hasKey: true })
  })
  it('основной сайт закрыт — берём ключ с мобильного', async () => {
    let saved = ''
    const f: Fetch = async (url) => {
      if (url === 'https://soundcloud.com/') throw new Error('reset')
      if (url === 'https://m.soundcloud.com/') return res(200, '<script src="https://a-v2.sndcdn.com/assets/m-1.js"></script>')
      if (url.endsWith('m-1.js')) return res(200, `client_id:"${CID}"`)
      return res(200, { collection: [] })
    }
    const sc = new SoundCloud(f, { get: () => null, set: (v) => { saved = v } })
    await sc.search('x')
    expect(saved).toBe(CID)
  })
  it('ключ обновляется тихо, только если старый', async () => {
    let site = 0
    const f: Fetch = async (url) => {
      if (url === 'https://soundcloud.com/') { site++; return res(200, '<script src="https://a-v2.sndcdn.com/assets/1-x.js"></script>') }
      return res(200, `client_id:"${CID}"`)
    }
    const fresh = new SoundCloud(f, { get: () => CID, set: () => {}, at: () => 1000 }, () => {}, { now: () => 2000 })
    await fresh.refreshKey()
    expect(site).toBe(0)
    const old = new SoundCloud(f, { get: () => CID, set: () => {}, at: () => 0 }, () => {}, { now: () => 13 * 3600_000 })
    await old.refreshKey()
    expect(site).toBe(1)
  })
})

describe('поток SoundCloud: если формат убран (404), пробуем следующий', () => {
  it('первый поток 404 — берём второй', async () => {
    const f: Fetch = async (url) => (url.includes('hls-aac') ? res(404, {}) : url.includes('hls-mp3') ? res(200, { url: 'https://cdn/ok.m3u8' }) : res(404, {}))
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    expect(await sc.streamUrl(mapScTrack(raw())!)).toBe('https://cdn/ok.m3u8')
  })
  it('все сохранённые потоки 404 — запрашиваем трек заново', async () => {
    const fresh = raw({ media: { transcodings: [{ url: 'https://api-v2.soundcloud.com/media/new-aac', format: { protocol: 'hls', mime_type: 'audio/mp4' } }] } })
    const f: Fetch = async (url) => (url.includes('/tracks/42') ? res(200, fresh) : url.includes('new-aac') ? res(200, { url: 'https://cdn/new.m3u8' }) : res(404, {}))
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    expect(await sc.streamUrl(mapScTrack(raw())!)).toBe('https://cdn/new.m3u8')
  })
})

describe('аккаунт SoundCloud', () => {
  it('лайки постранично, с ключом входа в заголовке', async () => {
    const seen: { url: string; auth?: string; method?: string }[] = []
    const f: Fetch = async (url, init) => {
      seen.push({ url, auth: init?.headers?.Authorization, method: init?.method })
      if (url.includes('/me?')) return res(200, { id: 9, username: 'mor' })
      if (url.includes('/track_likes') && !url.includes('page2')) return res(200, { collection: [{ track: raw({ id: 1 }) }], next_href: 'https://api-v2.soundcloud.com/users/9/track_likes?page2=1' })
      if (url.includes('page2')) return res(200, { collection: [{ track: raw({ id: 2 }) }] })
      return res(200, {})
    }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    sc.setAuth(async () => 'TOKEN')
    expect((await sc.likes()).map((t) => t.id)).toEqual(['sc_1', 'sc_2'])
    expect(seen.every((x) => x.auth === 'OAuth TOKEN')).toBe(true)
  })
  it('лайк ставится методом PUT, снимается DELETE', async () => {
    const calls: string[] = []
    const f: Fetch = async (url, init) => { if (url.includes('/me?')) return res(200, { id: 9 }); calls.push(`${init?.method} ${new URL(url).pathname}`); return res(200, {}) }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    sc.setAuth(async () => 'T')
    await sc.setLike(mapScTrack(raw())!, true)
    await sc.setLike(mapScTrack(raw())!, false)
    expect(calls).toEqual(['PUT /users/9/track_likes/42', 'DELETE /users/9/track_likes/42'])
  })
  it('без входа — пусто, а не ошибка', async () => {
    const sc = new SoundCloud(async () => res(200, {}), { get: () => CID, set: () => {} })
    expect(await sc.me()).toBeNull()
    expect(await sc.likes()).toEqual([])
  })
})

describe('лайк через страницу сайта SoundCloud', () => {
  const mk = (status: number) => {
    const calls: string[] = []
    const sc = new SoundCloud(async (url) => (url.includes('/me?') ? res(200, { id: 9 }) : res(200, { collection: [] })), { get: () => CID, set: () => {} })
    sc.setAuth(async () => 'TOKEN')
    sc.setWriter(async (m, url, tok) => { calls.push(`${m} ${new URL(url).pathname} ${tok}`); return status })
    return { sc, calls }
  }
  it('лайк уходит со страницы сайта с ключом входа', async () => {
    const { sc, calls } = mk(200)
    await sc.setLike(mapScTrack(raw())!, true)
    expect(calls).toEqual(['PUT /users/9/track_likes/42 TOKEN'])
  })
  it('снять лайк, которого нет (404), — не ошибка', async () => {
    const { sc } = mk(404)
    await expect(sc.setLike(mapScTrack(raw())!, false)).resolves.toBeUndefined()
  })
  it('отказ 403 — понятная ошибка, а весь SoundCloud не выключается', async () => {
    const { sc } = mk(403)
    await expect(sc.setLike(mapScTrack(raw())!, true)).rejects.toThrow('ответ 403')
    expect(sc.status().ok).toBe(true)
  })
})

describe('протухший вход в SoundCloud', () => {
  it('публичный запрос повторяется без ключа входа, а не гоняет client_id по кругу', async () => {
    const auth: Array<string | undefined> = []
    let siteHits = 0
    const f: Fetch = async (url, init) => {
      if (url.includes('/search/tracks')) {
        const a = init?.headers?.Authorization
        auth.push(a)
        return a ? res(401, {}) : res(200, { collection: [raw()] })
      }
      siteHits++
      return res(200, '')
    }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    sc.setAuth(async () => 'STALE')
    expect((await sc.search('night')).map((t) => t.id)).toEqual(['sc_42'])
    expect(auth).toEqual(['OAuth STALE', undefined])
    expect(siteHits).toBe(0) // за новым ключом не ходили: ключ-то рабочий
  })

  it('после этого вход считается потерянным — окно покажет «войти»', async () => {
    const f: Fetch = async (url, init) => {
      if (url.includes('/search/tracks')) return init?.headers?.Authorization ? res(401, {}) : res(200, { collection: [raw()] })
      if (url.includes('/me')) return res(200, { id: 5, username: 'morius' })
      return res(200, '')
    }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    sc.setAuth(async () => 'STALE')
    expect(await sc.me()).not.toBeNull()
    await sc.search('night')
    expect(await sc.me()).toBeNull()
    sc.setAuth(async () => 'NEW') // вошёл заново — снова работает
    expect(await sc.me()).not.toBeNull()
  })

  it('запрос, которому вход обязателен, по-прежнему честно жалуется', async () => {
    const f: Fetch = async () => res(401, {})
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    sc.setAuth(async () => 'STALE')
    await expect(sc.me()).rejects.toThrow(/Вход в SoundCloud устарел/)
  })
})

describe('треки артиста SoundCloud', () => {
  it('берёт страницу артиста и отдаёт свежее сверху', async () => {
    const f: Fetch = async (url) => {
      if (url.includes('/search/users')) return res(200, { collection: [{ id: 9, username: 'other' }, { id: 7, username: 'synthboy' }] })
      if (url.includes('/users/7/tracks')) return res(200, { collection: [
        raw({ id: 1, title: 'Старое', created_at: '2026-01-01T00:00:00Z' }),
        raw({ id: 2, title: 'Новое', created_at: '2026-10-01T00:00:00Z' })
      ] })
      return res(200, {})
    }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    expect((await sc.artistTracks('synthboy')).map((t) => t.title)).toEqual(['Новое', 'Старое'])
  })

  it('нет страницы — ищем треки по имени и чужое не берём', async () => {
    const f: Fetch = async (url) => {
      if (url.includes('/search/users')) return res(200, { collection: [] })
      if (url.includes('/search/tracks')) return res(200, { collection: [raw(), raw({ id: 5, user: { username: 'кто-то ещё' } })] })
      return res(200, {})
    }
    const sc = new SoundCloud(f, { get: () => CID, set: () => {} })
    expect((await sc.artistTracks('synthboy')).map((t) => t.id)).toEqual(['sc_42'])
  })
})
