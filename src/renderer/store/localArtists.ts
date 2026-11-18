import { create } from 'zustand'
import type { ArtistSubscription } from '../../shared/types'
import { readJson, writeJson } from './json'

export type LocalArtist = ArtistSubscription & { source: 'vk' | 'sc' }
const STORAGE_KEY = 'localArtistSubscriptions'
const VK_HIDDEN_KEY = 'hiddenVkArtistSubscriptions'
const nameKey = (name: string) => name.trim().toLocaleLowerCase('ru-RU')
const artistNameKey = (artist: LocalArtist) => `${artist.source}:name:${nameKey(artist.name)}`
export const localArtistKey = (artist: LocalArtist) => artist.id ? `${artist.source}:id:${artist.id}` : artistNameKey(artist)

function findLocalArtist(artists: LocalArtist[], artist: LocalArtist): LocalArtist | undefined {
  const exact = artists.find((item) => localArtistKey(item) === localArtistKey(artist))
  if (exact) return exact
  const matches = artists.filter((item) => artistNameKey(item) === artistNameKey(artist))
  if (matches.length === 1 && (!artist.id || !matches[0].id)) return matches[0]
}

export function mergeLocalArtists(current: LocalArtist[], added: LocalArtist[]): LocalArtist[] {
  const all = [...current, ...added]
  const idsByName = new Map<string, string | null>()
  // Имя связывает записи только тогда, когда ему соответствует один ID в этом сервисе.
  for (const artist of all) {
    if (!artist.id) continue
    const name = artistNameKey(artist)
    const previous = idsByName.get(name)
    idsByName.set(name, previous === undefined || previous === artist.id ? artist.id : null)
  }
  const merged = new Map<string, LocalArtist>()
  for (const artist of all) {
    const id = artist.id || idsByName.get(artistNameKey(artist)) || ''
    const key = localArtistKey({ ...artist, id })
    const previous = merged.get(key)
    merged.set(key, {
      ...artist, id,
      name: !artist.id && previous?.id ? previous.name : artist.name,
      cover: artist.cover || previous?.cover,
      link: artist.link || previous?.link
    })
  }
  return [...merged.values()]
}

export function toggleLocalArtist(current: LocalArtist[], artist: LocalArtist): { artists: LocalArtist[]; added: boolean } {
  const existing = findLocalArtist(current, artist)
  return { artists: existing ? current.filter((item) => localArtistKey(item) !== localArtistKey(existing)) : mergeLocalArtists(current, [artist]), added: !existing }
}

type LocalArtists = {
  artists: LocalArtist[]
  hiddenVk: LocalArtist[]
  toggle(artist: LocalArtist): boolean
  remove(artist: LocalArtist): void
  removeMany(keys: readonly string[]): number
  import(source: 'vk' | 'sc', artists: ArtistSubscription[]): number
  syncVk(artists: ArtistSubscription[]): void
  has(artist: { source: 'vk' | 'sc'; id?: string; name: string }): boolean
}

export const useLocalArtists = create<LocalArtists>((set, get) => ({
  artists: readJson<LocalArtist[]>(STORAGE_KEY, []),
  hiddenVk: readJson<LocalArtist[]>(VK_HIDDEN_KEY, []),
  toggle(artist) {
    const existing = findLocalArtist(get().artists, artist)
    if (existing) {
      get().removeMany([localArtistKey(existing)])
      return false
    }
    const artists = mergeLocalArtists(get().artists, [artist])
    const hidden = findLocalArtist(get().hiddenVk, artist)
    if (hidden) {
      const hiddenVk = get().hiddenVk.filter((item) => localArtistKey(item) !== localArtistKey(hidden))
      set({ hiddenVk }); writeJson(VK_HIDDEN_KEY, hiddenVk)
    }
    set({ artists }); writeJson(STORAGE_KEY, artists)
    return true
  },
  remove(artist) {
    const existing = findLocalArtist(get().artists, artist)
    if (existing) get().removeMany([localArtistKey(existing)])
  },
  removeMany(keys) {
    const selected = new Set(keys)
    const current = get().artists
    const artists = current.filter((item) => !selected.has(localArtistKey(item)))
    const count = current.length - artists.length
    if (!count) return 0
    const hiddenVk = mergeLocalArtists(get().hiddenVk, current.filter((item) => item.source === 'vk' && selected.has(localArtistKey(item))))
    set({ artists, hiddenVk })
    writeJson(STORAGE_KEY, artists); writeJson(VK_HIDDEN_KEY, hiddenVk)
    return count
  },
  syncVk(imported) {
    const hidden = get().hiddenVk
    const additions = imported.filter((artist) => !findLocalArtist(hidden, { ...artist, source: 'vk' }))
    get().import('vk', additions)
  },
  import(source, imported) {
    const current = mergeLocalArtists([], get().artists)
    const artists = mergeLocalArtists(current, imported.map((artist) => ({ ...artist, source })))
    const count = artists.length - current.length
    set({ artists }); writeJson(STORAGE_KEY, artists)
    return count
  },
  has(artist) { return !!findLocalArtist(get().artists, { ...artist, id: artist.id ?? '' }) }
}))
