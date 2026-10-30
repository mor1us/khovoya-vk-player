import type { Track, Playlist } from '../../shared/types'
import { mapTrack, mapPlaylist } from './models'

type Caller = { call<T = any>(method: string, params: Record<string, string | number | undefined>): Promise<T> }

export interface AudioApi {
  myTracks(): Promise<Track[]>
  search(q: string, offset?: number): Promise<{ tracks: Track[]; playlists: Playlist[] }>
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
  reorder(t: Track, before?: string, after?: string): Promise<void>
}

const PAGE = 1000
const vkId = (id: string) => Number(id.split('_')[1])

export class VkAudioApi implements AudioApi {
  constructor(private vk: Caller, private me: () => number) {}

  private async pages(params: Record<string, string | number | undefined>): Promise<Track[]> {
    const out: Track[] = []
    for (let offset = 0; ; offset += PAGE) {
      const r = await this.vk.call<{ count: number; items: any[] }>('audio.get', { ...params, count: PAGE, offset })
      out.push(...r.items.map(mapTrack))
      if (!r.items.length || offset + PAGE >= r.count) return out
    }
  }

  myTracks() { return this.pages({ owner_id: this.me() }) }
  playlistTracks(p: Playlist) { return this.pages({ owner_id: p.ownerId, playlist_id: p.id, access_key: p.accessKey }) }

  async search(q: string, offset = 0) {
    const [t, p] = await Promise.all([
      this.vk.call<{ items: any[] }>('audio.search', { q, count: 100, offset, auto_complete: 1, sort: 2 }),
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
  async reorder(t: Track, before?: string, after?: string) {
    await this.vk.call('audio.reorder', { audio_id: t.vkId, owner_id: t.ownerId, before: before ? vkId(before) : undefined, after: after ? vkId(after) : undefined })
  }
}
