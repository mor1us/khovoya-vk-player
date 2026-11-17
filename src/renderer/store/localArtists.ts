import { create } from 'zustand'
import type { ArtistSubscription } from '../../shared/types'
import { readJson, writeJson } from './json'

export type LocalArtist = ArtistSubscription & { source: 'vk' | 'sc' }
const STORAGE_KEY = 'localArtistSubscriptions'
const nameKey = (name: string) => name.trim().toLocaleLowerCase('ru-RU')
export const localArtistKey = (artist: LocalArtist) => `${artist.source}:${artist.id || nameKey(artist.name)}`
const sameArtist = (a: LocalArtist, b: LocalArtist) => a.source === b.source && (a.id && b.id ? a.id === b.id : nameKey(a.name) === nameKey(b.name))

export function mergeLocalArtists(current: LocalArtist[], added: LocalArtist[]): LocalArtist[] {
  const merged = new Map(current.map((artist) => [localArtistKey(artist), artist]))
  for (const artist of added) {
    const key = localArtistKey(artist)
    const previous = merged.get(key)
    merged.set(key, { ...previous, ...artist, cover: artist.cover || previous?.cover, link: artist.link || previous?.link })
  }
  return [...merged.values()]
}

export function toggleLocalArtist(current: LocalArtist[], artist: LocalArtist): { artists: LocalArtist[]; added: boolean } {
  const exists = current.some((item) => sameArtist(item, artist))
  return { artists: exists ? current.filter((item) => !sameArtist(item, artist)) : mergeLocalArtists(current, [artist]), added: !exists }
}

type LocalArtists = {
  artists: LocalArtist[]
  toggle(artist: LocalArtist): boolean
  remove(artist: LocalArtist): void
  import(source: 'vk' | 'sc', artists: ArtistSubscription[]): number
  has(artist: { source: 'vk' | 'sc'; id?: string; name: string }): boolean
}

export const useLocalArtists = create<LocalArtists>((set, get) => ({
  artists: readJson<LocalArtist[]>(STORAGE_KEY, []),
  toggle(artist) {
    const { artists, added } = toggleLocalArtist(get().artists, artist)
    set({ artists }); writeJson(STORAGE_KEY, artists)
    return added
  },
  remove(artist) {
    const artists = get().artists.filter((item) => !sameArtist(item, artist))
    set({ artists }); writeJson(STORAGE_KEY, artists)
  },
  import(source, imported) {
    const current = get().artists
    const artists = mergeLocalArtists(current, imported.map((artist) => ({ ...artist, source })))
    const count = artists.length - current.length
    set({ artists }); writeJson(STORAGE_KEY, artists)
    return count
  },
  has(artist) { return get().artists.some((item) => sameArtist(item, { ...artist, id: artist.id ?? '' })) }
}))
