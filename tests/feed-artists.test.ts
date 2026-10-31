import { describe, it, expect } from 'vitest'
import type { Track } from '../src/shared/types'
import { feedArtists } from '../src/renderer/ui/feedArtists'

const t = (id: string, artist: string): Track => ({ id, ownerId: 0, vkId: 1, title: id, artist, duration: 1, url: '', available: true, src: 'sc' })

describe('подписки SoundCloud', () => {
  it('группирует ленту по артистам в порядке свежести', () => {
    const r = feedArtists([t('1', 'A'), t('2', 'B'), t('3', 'a'), t('4', 'C')], 2)
    expect(r.map((x) => [x.name, x.tracks.length])).toEqual([['A', 2], ['B', 1]])
  })
})
