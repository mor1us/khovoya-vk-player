import { describe, expect, it } from 'vitest'
import { mergeLocalArtists, toggleLocalArtist, type LocalArtist } from '../src/renderer/store/localArtists'

const artist = (source: 'vk' | 'sc', id: string, name = 'Artist'): LocalArtist => ({ source, id, name })

describe('подписки Хвои на артистов', () => {
  it('хранит артистов ВК и SoundCloud отдельно', () => {
    const list = mergeLocalArtists([], [artist('vk', '1'), artist('sc', '1')])
    expect(list).toHaveLength(2)
    expect(list.map((item) => item.source)).toEqual(['vk', 'sc'])
  })

  it('импорт дополняет список, не создавая повторов и сохраняя обложку', () => {
    const current = [{ ...artist('vk', '42'), cover: 'cover.jpg' }]
    const list = mergeLocalArtists(current, [artist('vk', '42', 'Новое имя'), artist('vk', '43')])
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ name: 'Новое имя', cover: 'cover.jpg' })
  })

  it('объединяет «Моё» с каталогом ВК и дополняет подписку ID', () => {
    const stored = [artist('vk', '', 'Юпи'), artist('sc', '42', 'Юпи')]
    const imported = [artist('vk', '', 'юпи'), { ...artist('vk', '42', 'Юпи'), cover: 'vk.jpg' }, artist('vk', '43', 'Другой артист')]
    const list = mergeLocalArtists(stored, imported)
    expect(list).toEqual([expect.objectContaining({ source: 'vk', id: '42', name: 'Юпи', cover: 'vk.jpg' }), stored[1], imported[2]])
    expect(mergeLocalArtists(list, imported)).toEqual(list)
  })

  it('сохраняет одноимённые профили с разными ID отдельно', () => {
    const first = artist('vk', '42')
    const second = artist('vk', '43')
    const unknown = artist('vk', '')
    const list = mergeLocalArtists([], [first, second, unknown])
    expect(toggleLocalArtist(list, unknown).artists).toEqual([first, second])
  })

  it('переключает локальную подписку без обращения к сервису', () => {
    const one = toggleLocalArtist([], artist('sc', '9'))
    const two = toggleLocalArtist(one.artists, artist('sc', '9'))
    expect(one.added).toBe(true)
    expect(two.added).toBe(false)
    expect(two.artists).toEqual([])
  })

  it('находит импортированную подписку, если профиль открыт по имени без ID', () => {
    const two = toggleLocalArtist([artist('vk', '55', 'Мой артист')], artist('vk', '', 'Мой артист'))
    expect(two.added).toBe(false)
    expect(two.artists).toEqual([])
  })
})
