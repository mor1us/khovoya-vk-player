import { describe, it, expect } from 'vitest'
import { artistPopularTracks, parseCatalog, subscriptionArtists, subscriptionSection } from '../src/main/vk/catalog'

it('берёт порядок треков из раздела «Популярное» артиста', () => {
  expect(artistPopularTracks({ section: { blocks: [
    { layout: { title: 'Популярное' }, audios_ids: ['-9_5_key', '10_2', '10_2'] },
    { layout: { title: 'Все треки' }, audios_ids: ['10_3'] }
  ] } })).toEqual(['-9_5', '10_2'])
})

describe('раздел подписок ВК', () => {
  it('находит переход во вложенном блоке вкладки «Моя музыка»', () => {
    expect(subscriptionSection({ catalog: { sections: [{
      id: 'library', title: 'Моя музыка',
      blocks: [{ layout: { title: 'Артисты и кураторы' }, actions: [{ title: 'Показать все', action: { type: 'open_section', section_id: 'following' } }] }]
    }] } })).toBe('following')
  })

  it('пропускает пустой идентификатор и не считает вкладку обновлений подписками', () => {
    expect(subscriptionSection({ blocks: [{ layout: { title: 'Подписки' }, section_id: '', action: { section_id: 'following' } }] })).toBe('following')
    expect(subscriptionSection({ catalog: { sections: [{ id: 'updates', title: 'Обновления' }] }, links: {} })).toBeUndefined()
  })

  it('пропускает исполнителей, для которых ВК явно указал отсутствие подписки', () => {
    expect(subscriptionArtists({
      artists: [{ id: 'a', name: 'ximora', is_following: 1 }, { id: 'b', name: 'Другой', is_followed: '0' }],
      links: [{ content_type: 'artist', artist_id: 'c', title: 'Рекомендация', is_subscribed: false }]
    })).toMatchObject([{ id: 'a', name: 'ximora' }])
  })
})

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
  it('returns playlist blocks in order with titles', () => {
    const r = parseCatalog(sample, 7)
    expect(r.map((b) => b.title).slice(0, 2)).toEqual(['Собрано алгоритмами', 'Новинки'])
    expect(r[0].playlists.map((p) => p.title)).toEqual(['Плейлист дня 1', 'Плейлист дня 2', 'Открытия недели'])
    expect(r[0].playlists[0]).toMatchObject({ id: 10, ownerId: -147845620, accessKey: 'k10', coverUrls: ['c10'], isMine: false })
  })
  it('«Плейлист дня» от имени самого пользователя не теряется и не считается его плейлистом', () => {
    const s = { playlists: [pl(77, 7, 'Плейлист дня 3')], blocks: [{ data_type: 'music_playlists', layout: { title: 'Собрано алгоритмами' }, playlists_ids: ['7_77'] }] }
    expect(parseCatalog(s, 7)[0].playlists[0]).toMatchObject({ title: 'Плейлист дня 3', isMine: false })
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
  it('limits to 8 blocks', () => {
    const blocks = Array.from({ length: 10 }, (_, i) => ({ data_type: 'music_playlists', layout: { title: 'B' + i }, playlists_ids: ['-2_5'] }))
    expect(parseCatalog({ playlists: sample.playlists, blocks }, 7).length).toBe(8)
  })
})

describe('parseCatalog: headers, big cards, subtitles', () => {
  const resp = {
    playlists: [
      { id: 1, owner_id: -147845620, title: 'Плейлист дня 1', description: 'Вы слушали: HELLBLADE, k3 mc', count: 50, photo: { photo_600: 'g1' } },
      { id: 2, owner_id: -147845620, title: 'Открытия', subtitle: 'Новое для вас', count: 50 },
      { id: 3, owner_id: -2, title: 'Рок', count: 10 }
    ],
    catalog: { sections: [{ blocks: [
      { data_type: 'none', layout: { name: 'header', title: 'Собрано алгоритмами' } },
      { data_type: 'music_playlists', layout: { name: 'large_slider' }, playlists_ids: ['-147845620_1', '-147845620_2'] },
      { data_type: 'none', layout: { name: 'header_extended', title: 'Жанры' } },
      { data_type: 'music_playlists', layout: { name: 'slider' }, playlists_ids: ['-2_3'] },
      { data_type: 'music_playlists', layout: { name: 'large_slider' }, playlists_ids: ['-2_3'] }
    ] }] }
  }
  it('takes the title from the preceding header block and marks large sliders big', () => {
    const r = parseCatalog(resp, 7)
    expect(r.map((b) => [b.title, b.big])).toEqual([['Собрано алгоритмами', true], ['Жанры', false], ['Для вас', true]])
  })
  it('keeps playlist subtitle from description/subtitle', () => {
    const r = parseCatalog(resp, 7)
    expect(r[0].playlists.map((p) => p.subtitle)).toEqual(['Вы слушали: HELLBLADE, k3 mc', 'Новое для вас'])
  })
  it('never shows layout names like large_slider as a title', () => {
    expect(parseCatalog(resp, 7).some((b) => /_/.test(b.title))).toBe(false)
  })
})
