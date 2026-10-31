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
