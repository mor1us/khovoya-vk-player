import { describe, it, expect, beforeEach } from 'vitest'
import { installBridge } from '../src/mobile/bridge'
import { memStore } from '../src/mobile/storage'
import { IPC, type Channel } from '../src/shared/ipc'
import type { AudioApi } from '../src/main/vk/audio'
import type { Playlist, Track } from '../src/shared/types'

const track = (id: string): Track => ({ id, ownerId: 1, vkId: +id.split('_')[1], title: 'Трек', artist: 'Кто-то', duration: 100, url: 'https://x/1.mp3', available: true })
const pl = (id: number): Playlist => ({ id, ownerId: 1, title: 'Список', count: 1, coverUrls: [], isMine: true, updatedAt: 0 })

function stubApi(over: Partial<AudioApi> = {}): AudioApi {
  return {
    myTracks: async () => [track('1_1')],
    search: async () => ({ tracks: [track('1_2')], playlists: [pl(1)] }),
    playlists: async () => [pl(1)],
    playlistTracks: async () => [track('1_3')],
    recommendations: async () => [], popular: async () => [], byId: async () => [],
    add: async () => {}, remove: async () => {},
    createPlaylist: async () => pl(2), editPlaylist: async () => {}, addToPlaylist: async () => {},
    removeFromPlaylist: async () => {}, deletePlaylist: async () => {}, reorder: async () => {},
    forYou: async () => [], artistTracks: async () => [],
    ...over
  }
}

const deps = (over = {}) => ({
  api: stubApi(),
  store: memStore(),
  session: async () => ({ loggedIn: true, userName: 'Мориус' }),
  login: async () => ({ kind: 'ok' as const, userName: 'Мориус' }),
  logout: async () => {},
  ...over
})

beforeEach(() => { delete (globalThis as { window?: unknown }).window; (globalThis as { window: unknown }).window = {} })

describe('мобильный мост', () => {
  it('отвечает на каждый канал из белого списка', async () => {
    installBridge(deps())
    const skip = new Set<Channel>(['auth:browser']) // открывает экран входа, проверяется отдельно
    for (const ch of Object.keys(IPC) as Channel[]) {
      if (skip.has(ch)) continue
      const invoke = window.api.invoke as (c: string, ...a: unknown[]) => Promise<unknown>
      await expect(invoke(ch), `канал ${ch}`).resolves.not.toThrow()
    }
  })

  it('каналы, которых на телефоне нет, отвечают, а не падают', async () => {
    installBridge(deps())
    await expect(window.api.invoke('upd:state')).resolves.toMatchObject({ status: 'disabled' })
    await expect(window.api.invoke('sc:status')).resolves.toMatchObject({ ok: false, hasKey: false })
    await expect(window.api.invoke('win:close')).resolves.toBeUndefined()
    await expect(window.api.invoke('settings:pickDir')).resolves.toBeNull()
    await expect(window.api.invoke('dl:list')).resolves.toEqual([])
  })

  it('обрыв сети превращается в понятную фразу без кодов', async () => {
    installBridge(deps({ api: stubApi({ myTracks: async () => { throw new Error('fetch failed') } }) }))
    await expect(window.api.invoke('vk:myTracks')).rejects.toThrow('Нет подключения')
  })

  it('треки ВК идут из AudioApi, а не выдумываются', async () => {
    installBridge(deps())
    await expect(window.api.invoke('vk:myTracks')).resolves.toEqual([track('1_1')])
  })

  it('настройки переживают перезапуск окна', async () => {
    const store = memStore()
    installBridge(deps({ store }))
    await window.api.invoke('settings:set', { crossfadeSec: 7 })
    installBridge(deps({ store }))
    await expect(window.api.invoke('settings:get')).resolves.toMatchObject({ crossfadeSec: 7 })
  })

  it('неизвестный канал не проходит', async () => {
    installBridge(deps())
    const invoke = window.api.invoke as (c: string) => Promise<unknown>
    await expect(invoke('fs:read')).rejects.toThrow('Недоступно')
  })
})
