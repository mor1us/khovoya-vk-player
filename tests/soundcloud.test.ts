import { describe, it, expect } from 'vitest'
import { SoundCloud, findClientId, findScriptUrls, mapScTrack, pickTranscoding, type Fetch } from '../src/main/sc/soundcloud'

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

  it('выбирает HLS mp3, а не AAC и не зашифрованный', () => {
    expect(pickTranscoding(raw())?.url).toBe('https://api-v2.soundcloud.com/media/hls-mp3')
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
