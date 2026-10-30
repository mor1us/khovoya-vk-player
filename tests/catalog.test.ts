import { describe, it, expect } from 'vitest'
import { parseCatalog } from '../src/main/vk/catalog'

const pl = (id: number, owner: number, title: string) => ({ id, owner_id: owner, title, count: 30, access_key: 'k' + id, thumbs: [{ photo_600: 'c' + id }] })
const sample = {
  catalog: { default_section: 's1', sections: [{ id: 's1', title: 'Главная', blocks: [
    { id: 'b0', data_type: 'music_audios', layout: { title: 'Мои треки' }, audios_ids: ['1_1'] },
    { id: 'b1', data_type: 'music_playlists', layout: { title: 'Собрано алгоритмами' }, playlists_ids: ['-147845620_10', '-147845620_11', '-147845620_12'] },
    { id: 'b2', data_type: 'music_playlists', layout: { title: 'Новинки' }, playlists_ids: ['-2_5'] },
    { id: 'b3', data_type: 'music_playlists', layout: { name: 'Мои плейлисты' }, playlists_ids: ['7_1'] }
  ] }] },
  playlists: [pl(10, -147845620, 'Плейлист дня 1'), pl(11, -147845620, 'Плейлист дня 2'), pl(12, -147845620, 'Открытия недели'), pl(5, -2, 'Новинки недели'), pl(1, 7, 'Мой')]
}

describe('parseCatalog', () => {
  it('returns playlist blocks in order with titles, skipping my own playlists', () => {
    const r = parseCatalog(sample, 7)
    expect(r.map((b) => b.title)).toEqual(['Собрано алгоритмами', 'Новинки'])
    expect(r[0].playlists.map((p) => p.title)).toEqual(['Плейлист дня 1', 'Плейлист дня 2', 'Открытия недели'])
    expect(r[0].playlists[0]).toMatchObject({ id: 10, ownerId: -147845620, accessKey: 'k10', coverUrls: ['c10'], isMine: false })
  })
  it('ids with access key suffix still match', () => {
    const s = { ...sample, catalog: { sections: [{ blocks: [{ data_type: 'music_playlists', layout: { title: 'Для вас' }, playlists_ids: ['-147845620_10_abc'] }] }] } }
    expect(parseCatalog(s, 7)[0].playlists[0].id).toBe(10)
  })
  it('top-level blocks array is supported too', () => {
    const s = { playlists: sample.playlists, blocks: [{ data_type: 'music_playlists', layout: { title: 'Для вас' }, playlists_ids: ['-2_5'] }] }
    expect(parseCatalog(s, 7)).toEqual([expect.objectContaining({ title: 'Для вас' })])
  })
  it('garbage → empty list', () => { expect(parseCatalog(null, 1)).toEqual([]); expect(parseCatalog({}, 1)).toEqual([]) })
  it('limits to 3 blocks', () => {
    const blocks = Array.from({ length: 5 }, (_, i) => ({ data_type: 'music_playlists', layout: { title: 'B' + i }, playlists_ids: ['-2_5'] }))
    expect(parseCatalog({ playlists: sample.playlists, blocks }, 7).length).toBe(3)
  })
})
