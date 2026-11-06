import { describe, it, expect } from 'vitest'
import { registerCore, type Handle } from '../src/shared/channels'
import { friendly } from '../src/shared/friendly'
import type { AudioApi } from '../src/main/vk/audio'
import type { Playlist, Track } from '../src/shared/types'

const track = (id: string): Track => ({ id, ownerId: 1, vkId: 1, title: 'Трек', artist: 'Кто-то', duration: 100, url: '', available: true })
const pl = (id: number): Playlist => ({ id, ownerId: 1, title: 'Список', count: 0, coverUrls: [], isMine: true, updatedAt: 0 })

function stubApi(over: Partial<AudioApi> = {}): AudioApi {
  return {
    myTracks: async () => [track('1_1')], search: async () => ({ tracks: [], playlists: [] }),
    playlists: async () => [pl(1)], playlistTracks: async () => [], recommendations: async () => [],
    popular: async () => [], byId: async () => [], add: async () => {}, remove: async () => {},
    createPlaylist: async () => pl(2), editPlaylist: async () => {}, addToPlaylist: async () => {},
    removeFromPlaylist: async () => {}, deletePlaylist: async () => {}, reorder: async () => {},
    forYou: async () => [], artistTracks: async () => [], ...over
  }
}

function collect(over: Partial<AudioApi> = {}) {
  const seen = new Map<string, (...a: never[]) => unknown>()
  const calls: string[] = []
  const handle: Handle = (ch, fn) => { seen.set(ch, fn as (...a: never[]) => unknown) }
  registerCore({
    api: () => stubApi(over),
    logout: () => { calls.push('logout') },
    session: async () => ({ loggedIn: true, userName: 'Мориус' }),
    window: { min: () => calls.push('min'), max: () => calls.push('max'), close: () => calls.push('close') }
  }, handle)
  return { seen, calls }
}

describe('таблица каналов', () => {
  it('собирается без Electron', () => {
    const { seen } = collect()
    for (const c of ['auth:session', 'auth:logout', 'vk:myTracks', 'vk:search', 'vk:byId', 'pl:create', 'pl:reorder', 'win:min', 'win:max', 'win:close']) {
      expect(seen.has(c), `канал ${c}`).toBe(true)
    }
  })

  it('канал отдаёт то, что вернул AudioApi, а не ходит в сеть сам', async () => {
    const { seen } = collect()
    await expect(seen.get('vk:myTracks')!()).resolves.toEqual([track('1_1')])
  })

  it('кнопки окна зовут то, что им дали, а не Electron напрямую', () => {
    const { seen, calls } = collect()
    seen.get('win:min')!(); seen.get('win:close')!()
    expect(calls).toEqual(['min', 'close'])
  })
})

describe('friendly', () => {
  it('обрыв сети переводит в понятную фразу без кодов', () => {
    expect(friendly(new Error('fetch failed')).message).toBe('Нет подключения')
    expect(friendly(new Error('ENOTFOUND api.vk.com')).message).toBe('Нет подключения')
  })
  it('понятный текст оставляет как есть', () => {
    expect(friendly(new Error('Сессия ВК закончилась, войди снова')).message).toBe('Сессия ВК закончилась, войди снова')
  })
})
