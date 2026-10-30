import { describe, it, expect } from 'vitest'
import { mapTrack, mapPlaylist } from '../src/main/vk/models'
describe('models', () => {
  it('maps track id, availability and cover', () => {
    const t = mapTrack({ owner_id: 1, id: 2, artist: 'A', title: 'B', duration: 100, url: '', album: { thumb: { photo_300: 's', photo_600: 'big' } }, date: 5 })
    expect(t.id).toBe('1_2')
    expect(t.available).toBe(false)
    expect(t.coverUrl).toBe('big')
    expect(t.addedAt).toBe(5)
  })
  it('available when url present and not restricted', () => {
    expect(mapTrack({ owner_id: 1, id: 3, artist: 'A', title: 'B', duration: 1, url: 'https://x' }).available).toBe(true)
    expect(mapTrack({ owner_id: 1, id: 3, artist: 'A', title: 'B', duration: 1, url: 'https://x', content_restricted: 1 }).available).toBe(false)
  })
  it('maps playlist covers and ownership', () => {
    const p = mapPlaylist({ id: 9, owner_id: 7, title: 'P', count: 3, update_time: 10, thumbs: [{ photo_600: 'a' }], access_key: 'k' }, 7)
    expect(p).toMatchObject({ id: 9, ownerId: 7, title: 'P', count: 3, coverUrls: ['a'], isMine: true, accessKey: 'k', updatedAt: 10 })
    expect(mapPlaylist({ id: 1, owner_id: 2, title: 'x', count: 0, photo: { photo_600: 'c' } }, 7)).toMatchObject({ isMine: false, coverUrls: ['c'] })
  })
  it('followed playlist uses original owner', () => {
    const p = mapPlaylist({ id: 1, owner_id: 7, title: 'x', count: 0, original: { playlist_id: 50, owner_id: -3, access_key: 'q' } }, 7)
    expect(p).toMatchObject({ id: 50, ownerId: -3, accessKey: 'q', isMine: false })
  })
})
