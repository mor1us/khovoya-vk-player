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
