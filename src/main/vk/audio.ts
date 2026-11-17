import type { Track, Playlist, ArtistRef, ArtistInfo } from '../../shared/types'
import { mapTrack, mapPlaylist } from './models'
import { catalogSummary, parseCatalog, type ForYouBlock } from './catalog'

type Caller = { call<T = any>(method: string, params: Record<string, string | number | undefined>): Promise<T> }

export interface AudioApi {
  myTracks(): Promise<Track[]>
  search(q: string, offset?: number, byDate?: boolean): Promise<{ tracks: Track[]; playlists: Playlist[] }>
  playlists(): Promise<Playlist[]>
  playlistTracks(p: Playlist): Promise<Track[]>
  recommendations(target?: string, count?: number): Promise<Track[]>
  popular(): Promise<Track[]>
  byId(ids: string[]): Promise<Track[]>
  add(t: Track): Promise<void>
  remove(t: Track): Promise<void>
  createPlaylist(title: string): Promise<Playlist>
  editPlaylist(p: Playlist, title: string): Promise<void>
  addToPlaylist(p: Playlist, ids: string[]): Promise<void>
  removeFromPlaylist(p: Playlist, ids: string[]): Promise<void>
  deletePlaylist(p: Playlist): Promise<void>
  reorder(t: Track, before?: string, after?: string, playlist?: Playlist): Promise<void>
  forYou(): Promise<ForYouBlock[]>
  artistTracks(a: ArtistRef, offset?: number): Promise<Track[]>
  artistInfo(a: ArtistRef): Promise<ArtistInfo>
  followArtist(a: ArtistRef, on: boolean): Promise<void>
}

export type { ArtistInfo }

const PAGE = 1000
const vkId = (id: string) => Number(id.split('_')[1])

export class VkAudioApi implements AudioApi {
  constructor(private vk: Caller, private me: () => number, private log: (m: string) => void = () => {}) {}

  /** Треки исполнителя, новые сверху. */
  async artistTracks(a: ArtistRef, offset = 0): Promise<Track[]> {
    const byDate = (xs: Track[]) => xs.sort((x, y) => (y.addedAt ?? 0) - (x.addedAt ?? 0))
    if (a.id) {
      try {
        const r = await this.vk.call<{ items: any[] }>('audio.getAudiosByArtist', { artist_id: a.id, count: 30, ...(offset ? { offset } : {}) })
        return byDate(r.items.map(mapTrack))
      } catch (e) { this.log(`getAudiosByArtist: ${(e as Error).message}`) }
    }
    const name = a.name.trim().toLowerCase()
    const found = new Map<string, Track>()
    const scanned = new Set<string>()
    // Смещение в выдаче ВК включает чужие треки, а смещение страницы — только совпадения.
    const batch = 60
    for (let start = 0; start < 1200 && found.size < offset + 30; start += batch) {
      const r = await this.vk.call<{ items: any[] }>('audio.search', { q: a.name, count: batch, sort: 0, performer_only: 1, ...(start ? { offset: start } : {}) })
      const before = scanned.size
      for (const t of r.items.map(mapTrack)) {
        scanned.add(t.id)
        const matches = t.artists?.some((artist) => a.id ? artist.id === a.id : artist.name.trim().toLowerCase() === name)
          ?? t.artist.toLowerCase().split(/\s+(?:feat\.?|ft\.?|x|&)\s+|,/).some((artist) => artist.trim() === name)
        if (matches) found.set(t.id, t)
      }
      if (r.items.length < batch || scanned.size === before) break
    }
    return byDate([...found.values()]).slice(offset, offset + 30)
  }

  /** Подписан ли ты на исполнителя и его фотография. Без id ВК про него ничего не знает. */
  async artistInfo(a: ArtistRef): Promise<ArtistInfo> {
    let id = a.id
    if (!id) {
      const { tracks } = await this.search(a.name)
      const name = a.name.trim().toLowerCase()
      const ids = [...new Set(tracks.flatMap((t) => t.artists ?? []).filter((x) => x.name.trim().toLowerCase() === name).map((x) => x.id))]
      if (ids.length !== 1) return { missing: true, followed: false, can: false }
      id = ids[0]
    }
    const r = await this.vk.call<any>('audio.getArtistById', { artist_id: id, extended: 1 }).catch((e: unknown) => {
      this.log(`getArtistById: ${(e as Error).message}`)
      return null
    })
    const photo: any[] = r?.photo ?? r?.artist?.photo ?? []
    const best = photo.length ? photo[photo.length - 1]?.url : undefined
    const followed = r?.is_followed ?? r?.artist?.is_followed
    if (![true, false, 0, 1, '0', '1'].includes(followed)) {
      if (r) this.log('getArtistById: ВК не вернул состояние подписки')
      return { id, followed: false, statusUnknown: true, cover: best ? String(best) : undefined, can: true }
    }
    return { id, followed: followed === true || followed === 1 || followed === '1', cover: best ? String(best) : undefined, can: true }
  }

  /**
   * Подписка на исполнителя — то же, что сердечко у артиста на сайте ВК.
   * Отписку разные версии приложения ВК делают по-разному, и какой метод жив сегодня — заранее не скажешь.
   * Поэтому пробуем известные по очереди и пишем в журнал, что ответил каждый.
   */
  async followArtist(a: ArtistRef, on: boolean): Promise<void> {
    if (!a.id) throw new Error('ВК не знает такого исполнителя')
    if (on) { await this.vk.call('audio.followArtist', { artist_id: a.id }); return }
    const ways: Array<[string, Record<string, string | number>]> = [
      ['audio.unfollowArtist', { artist_id: a.id }],
      ['audio.followArtist', { artist_id: a.id, unfollow: 1 }]
    ]
    let last: Error | null = null
    for (const [method, params] of ways) {
      try { await this.vk.call(method, params); return } catch (e) {
        last = e as Error
        this.log(`${method}: ${last.message}`)
      }
    }
    throw last ?? new Error('ВК не дал отписаться')
  }

  /** Подборки «для вас» из каталога ВК (плейлисты дня и т.п.). */
  async forYou(): Promise<ForYouBlock[]> {
    const r = await this.vk.call<any>('catalog.getAudio', { need_blocks: 1, v: '5.215' })
    let blocks = parseCatalog(r, this.me())
    const sec = r?.catalog?.default_section
    if (!blocks.length && sec) {
      const s = await this.vk.call<any>('catalog.getSection', { section_id: sec, v: '5.215' })
      blocks = parseCatalog({ ...s, blocks: s?.section?.blocks ?? s?.blocks }, this.me())
    }
    if (!blocks.length) this.log(`каталог без подборок: ключи ${Object.keys(r ?? {}).join(',')}`)
    else this.log('каталог ВК: ' + catalogSummary(blocks).slice(0, 1500))
    return blocks
  }

  private async pages(params: Record<string, string | number | undefined>): Promise<Track[]> {
    const out: Track[] = []
    for (let offset = 0; ; offset += PAGE) {
      const r = await this.vk.call<{ count: number; items: any[] }>('audio.get', { ...params, count: PAGE, offset })
      out.push(...r.items.map(mapTrack))
      // неполная страница значит, что это была последняя; на отсутствующий count не надеемся —
      // без этой проверки цикл был бы вечным и долбил бы ВК запросами
      if (r.items.length < PAGE || !Number.isFinite(r.count) || offset + PAGE >= r.count) return out
    }
  }

  myTracks() { return this.pages({ owner_id: this.me() }) }
  playlistTracks(p: Playlist) { return this.pages({ owner_id: p.ownerId, playlist_id: p.id, access_key: p.accessKey }) }

  async search(q: string, offset = 0, byDate = false) {
    const [t, p] = await Promise.all([
      this.vk.call<{ items: any[] }>('audio.search', { q, count: 100, offset, auto_complete: 1, sort: byDate ? 0 : 2 }),
      this.vk.call<{ items: any[] }>('audio.searchPlaylists', { q, count: 20 }).catch(() => ({ items: [] }))
    ])
    return { tracks: t.items.map(mapTrack), playlists: p.items.map((x) => mapPlaylist(x, this.me())) }
  }

  async playlists() {
    const r = await this.vk.call<{ items: any[] }>('audio.getPlaylists', { owner_id: this.me(), count: 200 })
    return r.items.map((x) => mapPlaylist(x, this.me()))
  }

  async recommendations(target?: string, count = 50) {
    const r = await this.vk.call<{ items: any[] }>('audio.getRecommendations', { target_audio: target, count, user_id: target ? undefined : this.me() })
    return r.items.map(mapTrack)
  }

  async popular() {
    const r = await this.vk.call<any[]>('audio.getPopular', { count: 100, only_eng: 0 })
    return (Array.isArray(r) ? r : (r as any).items ?? []).map(mapTrack)
  }

  async byId(ids: string[]) {
    const r = await this.vk.call<any[]>('audio.getById', { audios: ids.join(',') })
    return r.map(mapTrack)
  }

  async add(t: Track) { await this.vk.call('audio.add', { audio_id: t.vkId, owner_id: t.ownerId, access_key: t.accessKey }) }
  async remove(t: Track) { await this.vk.call('audio.delete', { audio_id: t.vkId, owner_id: t.ownerId }) }

  async createPlaylist(title: string) {
    const r = await this.vk.call('audio.createPlaylist', { owner_id: this.me(), title })
    return mapPlaylist(r, this.me())
  }
  async editPlaylist(p: Playlist, title: string) { await this.vk.call('audio.editPlaylist', { owner_id: p.ownerId, playlist_id: p.id, title }) }
  async addToPlaylist(p: Playlist, ids: string[]) { await this.vk.call('audio.addToPlaylist', { owner_id: p.ownerId, playlist_id: p.id, audio_ids: ids.join(',') }) }
  async removeFromPlaylist(p: Playlist, ids: string[]) { await this.vk.call('audio.removeFromPlaylist', { owner_id: p.ownerId, playlist_id: p.id, audio_ids: ids.join(',') }) }
  async deletePlaylist(p: Playlist) { await this.vk.call('audio.deletePlaylist', { owner_id: p.ownerId, playlist_id: p.id }) }
  async reorder(t: Track, before?: string, after?: string, playlist?: Playlist) {
    await this.vk.call('audio.reorder', {
      audio_id: t.vkId, owner_id: playlist ? playlist.ownerId : this.me(), playlist_id: playlist?.id,
      before: before ? vkId(before) : undefined, after: after ? vkId(after) : undefined
    })
  }
}
