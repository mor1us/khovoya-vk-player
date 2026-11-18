import type { Track, Playlist, ArtistRef, ArtistInfo } from '../../shared/types'
import { mapTrack, mapPlaylist, vkFlag } from './models'
import { artistSubscriptionState, catalogSummary, parseCatalog, subscriptionArtists, subscriptionCatalogShape, subscriptionSection, type ForYouBlock } from './catalog'

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
// Каталог и аудио используют внутреннюю версию VK Music, она не совпадает с публичной v=5.x.
const MUSIC_API_VERSION = '8.154'
const vkId = (id: string) => Number(id.split('_')[1])

export class VkAudioApi implements AudioApi {
  constructor(private vk: Caller, private me: () => number, private log: (m: string) => void = () => {}) {}
  private subscriptions?: { user: number; expires: number; request: ReturnType<VkAudioApi['fetchArtistSubscriptions']> }

  private async musicCall<T = any>(method: string, params: Record<string, string | number | undefined>): Promise<T> {
    return this.vk.call<T>(method, { ...params, v: MUSIC_API_VERSION })
  }

  artistSubscriptions(force = true) {
    const user = this.me()
    const cached = this.subscriptions
    if (!force && cached?.user === user && cached.expires > Date.now()) return cached.request
    const request = this.fetchArtistSubscriptions().catch((error: unknown) => {
      const code = (error as { code?: unknown })?.code
      this.log(`подписки ВК: загрузка не удалась${typeof code === 'number' ? ` (код ВК ${code})` : ''}`)
      throw error
    })
    this.subscriptions = { user, expires: Date.now() + 60_000, request }
    return request
  }

  private async fetchArtistSubscriptions() {
    let sectionId: string | undefined
    let diagnostic: any
    let step = 'старт'
    {
      const params = { need_blocks: 1, extended: 1, v: MUSIC_API_VERSION }
      const probe = async (label: string, method: 'catalog.getAudio' | 'catalog.getSection', extra: Record<string, string | number> = {}) => {
        step = label
        const payload = await this.vk.call(method, { ...params, ...extra })
        const id = subscriptionSection(payload)
        if (!id) this.log(`подписки ВК: ${step} без ссылки на раздел (${subscriptionCatalogShape(payload)})`)
        return { payload, id }
      }
      try {
        const { payload: root, id } = await probe('каталог', 'catalog.getAudio')
        sectionId = id
        diagnostic = root
        const librarySection = root?.catalog?.sections?.find((section: any) => /^(?:моя музыка|my music)$/i.test(String(section?.title ?? '').trim()))
        const librarySectionId = librarySection?.section_id ?? librarySection?.id
        if (!sectionId && typeof librarySectionId === 'string' && librarySectionId) {
          sectionId = (await probe('моя музыка', 'catalog.getSection', { section_id: librarySectionId })).id
        }
        if (!sectionId) {
          const { payload: library, id } = await probe('каталог библиотеки', 'catalog.getAudio', { url: `https://vk.com/audios${this.me()}` })
          sectionId = id
          diagnostic = library
          const libraryId = library?.catalog?.default_section
          if (!sectionId && typeof libraryId === 'string') {
            sectionId = (await probe('главная библиотеки', 'catalog.getSection', { section_id: libraryId })).id
          }
        }
        if (!sectionId) {
          const index = await probe('оглавление каталога', 'catalog.getAudio', { need_blocks: 0 })
          diagnostic = index.payload
          sectionId = index.id
        }
      } catch (error) {
        const code = (error as { code?: unknown })?.code
        this.log(`подписки ВК: ${step} завершился ошибкой${typeof code === 'number' ? ` (код ВК ${code})` : ''}`)
        throw error
      }
    }
    if (!sectionId) {
      const titles = (diagnostic?.catalog?.sections ?? []).map((section: any) => String(section?.title ?? section?.layout?.title ?? '')).filter(Boolean).slice(0, 12)
      this.log(`подписки ВК: раздел не найден; версия API ${MUSIC_API_VERSION}; разделы: ${titles.join(' | ') || 'пусто'}`)
      throw new Error('ВК не открыл раздел подписок на артистов')
    }
    const params = { need_blocks: 1, extended: 1, v: MUSIC_API_VERSION }
    const result = new Map<string, ReturnType<typeof subscriptionArtists>[number]>()
    const seen = new Set<string>()
    let cursor: string | undefined
    const sections = new Set([sectionId])
    for (;;) {
      if (cursor && seen.has(cursor)) throw new Error('ВК не дал дочитать список подписок')
      if (cursor) seen.add(cursor)
      const page: { section?: { next_from?: string; blocks?: Array<{ id?: string; data_type?: string; next_from?: string }> } } = await this.vk.call('catalog.getSection', { ...params, section_id: sectionId, start_from: cursor })
      if (!page?.section) throw new Error('ВК не вернул список подписок')
      const artists = subscriptionArtists(page)
      const child: string | undefined = !cursor && !artists.length ? subscriptionSection(page) : undefined
      if (child && !sections.has(child)) { sections.add(child); sectionId = child; continue }
      for (const artist of artists) result.set(artist.id, artist)
      for (const block of page.section.blocks ?? []) {
        if (!/artist/i.test(String(block?.data_type ?? ''))) continue
        const blockCursors = new Set<string>()
        let next = block.next_from
        while (typeof next === 'string' && next && !blockCursors.has(next)) {
          blockCursors.add(next)
          const part = await this.vk.call<any>('catalog.getBlockItems', { ...params, block_id: block.id, start_from: next })
          for (const artist of subscriptionArtists(part)) result.set(artist.id, artist)
          next = part?.block?.next_from
        }
      }
      cursor = page.section.next_from || undefined
      if (!cursor) break
    }
    return [...result.values()]
  }

  /** Треки исполнителя, новые сверху. */
  async artistTracks(a: ArtistRef, offset = 0): Promise<Track[]> {
    const byDate = (xs: Track[]) => xs.sort((x, y) => (y.addedAt ?? 0) - (x.addedAt ?? 0))
    if (a.id) {
      try {
        const r = await this.musicCall<{ items: any[] }>('audio.getAudiosByArtist', { artist_id: a.id, count: 30, ...(offset ? { offset } : {}) })
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
    const searchArtistRefs = async () => {
      const response = await this.vk.call<{ items: unknown[] }>('audio.search', { q: a.name, count: 60, performer_only: 1 })
      return response.items.flatMap((item) => mapTrack(item).artists ?? [])
    }
    let refs: Awaited<ReturnType<typeof searchArtistRefs>> | undefined
    if (!id) {
      refs = await searchArtistRefs()
      const name = a.name.trim().toLowerCase()
      const ids = [...new Set(refs.filter((x) => x.name.trim().toLowerCase() === name).map((x) => x.id))]
      if (ids.length !== 1) return { missing: true, followed: false, can: false }
      id = ids[0]
    }
    const r = await this.musicCall<any>('catalog.getAudioArtist', { artist_id: id, extended: 1 }).catch((e: unknown) => {
      this.log(`getAudioArtist: ${(e as Error).message}`)
      return null
    })
    const photo: any[] = r?.photo ?? r?.artist?.photo ?? []
    const best = photo.length ? photo[photo.length - 1]?.url : undefined
    const canFollow = vkFlag(r?.artist?.can_follow ?? r?.can_follow) ?? true
    let followed = artistSubscriptionState(r, id)
    const section = r?.catalog?.default_section
    if (followed === undefined && typeof section === 'string' && section) {
      const page = await this.musicCall<any>('catalog.getSection', { section_id: section, need_blocks: 1, extended: 1 }).catch(() => null)
      followed = artistSubscriptionState(page, id)
    }
    if (followed === undefined) {
      const subscription = await this.artistSubscriptions(false).then((list) => list.find((artist) => artist.id === id)).catch(() => undefined)
      if (subscription) return { id, followed: true, cover: subscription.cover ?? best, can: canFollow }
      refs ??= await searchArtistRefs().catch(() => [])
      const states = new Set(refs.filter((artist) => artist.id === id && artist.followed !== undefined).map((artist) => artist.followed))
      if (states.size === 1) return { id, followed: states.has(true), cover: best, can: canFollow }
      if (r) this.log('getAudioArtist: ВК не вернул состояние подписки')
      return { id, followed: false, statusUnknown: true, cover: best ? String(best) : undefined, can: canFollow }
    }
    return { id, followed, cover: best ? String(best) : undefined, can: canFollow }
  }

  /**
   * Подписка на исполнителя — то же, что сердечко у артиста на сайте ВК.
   * Отписку разные версии приложения ВК делают по-разному, и какой метод жив сегодня — заранее не скажешь.
   * Поэтому пробуем известные по очереди и пишем в журнал, что ответил каждый.
   */
  async followArtist(a: ArtistRef, on: boolean): Promise<void> {
    if (!a.id) throw new Error('ВК не знает такого исполнителя')
    const target = { artist_id: a.id, ref: 'audio_player', v: MUSIC_API_VERSION }
    if (on) {
      const response = await this.musicCall<unknown>('audio.followArtist', target)
      this.log(`audio.followArtist: ответ ${JSON.stringify(response).slice(0, 120)}`)
      if (response === 0 || response === false || response === '0') throw new Error('ВК не принял подписку на этого артиста')
      this.subscriptions = undefined
      return
    }
    const ways: Array<[string, Record<string, string | number>]> = [
      ['audio.unfollowArtist', target],
      ['audio.followArtist', { ...target, unfollow: 1 }]
    ]
    let last: Error | null = null
    for (const [method, params] of ways) {
      let response: unknown
      try { response = await this.musicCall<unknown>(method, params) } catch (e) {
        last = e as Error
        this.log(`${method}: ${last.message}`)
        const code = (e as { code?: unknown })?.code
        if (method === 'audio.unfollowArtist' && (code === 3 || /unknown method/i.test(last.message))) continue
        throw e
      }
      this.log(`${method}: ответ ${JSON.stringify(response).slice(0, 120)}`)
      if (response === 0 || response === false || response === '0') throw new Error('ВК не принял отписку от этого артиста')
      this.subscriptions = undefined
      return
    }
    throw last ?? new Error('ВК не дал отписаться')
  }

  /** Подборки «для вас» из каталога ВК (плейлисты дня и т.п.). */
  async forYou(): Promise<ForYouBlock[]> {
    const r = await this.musicCall<any>('catalog.getAudio', { need_blocks: 1, extended: 1 })
    let blocks = parseCatalog(r, this.me())
    const sec = r?.catalog?.default_section
    if (!blocks.length && sec) {
      const s = await this.musicCall<any>('catalog.getSection', { section_id: sec, need_blocks: 1, extended: 1 })
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
