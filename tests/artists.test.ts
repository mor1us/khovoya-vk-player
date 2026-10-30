import { describe, it, expect } from 'vitest'
import { topArtists, isFresh, FRESH_DAYS } from '../src/renderer/store/artistsLogic'
import type { Track } from '../src/shared/types'

const tr = (i: number, artist: string, extra: Partial<Track> = {}): Track => ({ id: 't' + i, ownerId: 1, vkId: i, title: 'T' + i, artist, duration: 100, url: 'u', available: true, coverUrl: 'c' + i, ...extra })

describe('topArtists', () => {
  it('ranks by number of tracks, keeps id and a cover from the newest track', () => {
    const mine = [
      tr(1, 'Дворы', { artists: [{ id: 'a1', name: 'Дворы' }] }), tr(2, 'Мира Лин'), tr(3, 'Дворы', { artists: [{ id: 'a1', name: 'Дворы' }] }),
      tr(4, 'дворы '), tr(5, 'Мира Лин'), tr(6, 'Один')
    ]
    const top = topArtists(mine, 2)
    expect(top.map((a) => a.name)).toEqual(['Дворы', 'Мира Лин'])
    expect(top[0]).toMatchObject({ id: 'a1', count: 3, cover: 'c1' })
  })
  it('splits "feat." and comma lists by main artist only', () => {
    const top = topArtists([tr(1, 'A feat. B'), tr(2, 'A, C'), tr(3, 'A & D')], 3)
    expect(top[0]).toMatchObject({ name: 'A', count: 3 })
  })
  it('skips unknown artist', () => { expect(topArtists([tr(1, 'Неизвестен')], 3)).toEqual([]) })
})

describe('isFresh', () => {
  it(`within ${FRESH_DAYS} days`, () => {
    const now = 1_800_000_000_000
    expect(isFresh(now / 1000 - 3 * 86400, now)).toBe(true)
    expect(isFresh(now / 1000 - (FRESH_DAYS + 1) * 86400, now)).toBe(false)
    expect(isFresh(undefined, now)).toBe(false)
  })
})
