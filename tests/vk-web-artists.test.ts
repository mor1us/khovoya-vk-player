import { describe, expect, it } from 'vitest'
import { parseVkArtistCards, vkArtistProfile, vkArtistsPage } from '../src/main/vk/webArtistsLogic'

describe('страница «Музыканты» ВК', () => {
  it('запрашивает полный список для текущего аккаунта', () => {
    expect(vkArtistsPage(42).href).toBe('https://vk.ru/audios42?block=my_artists&section=all')
    expect(() => vkArtistsPage(0)).toThrow('Войди в ВК')
  })

  it('сохраняет ссылки на карточки артистов и объединяет дубли', () => {
    expect(parseVkArtistCards([
      { href: 'https://vk.com/artist/hxlkart_demo', name: ' Hxlkart ' },
      { href: 'https://vk.ru/artist/hxlkart_demo/?from=music', name: ' Hxlkart ', image: 'https://cdn.example/artist.png' },
      { href: 'https://vk.ru/audio42', name: 'Трек' },
      { href: 'https://vk.ru.example/artist/hxlkart_demo', name: 'Чужой сайт' }
    ])).toEqual([{ id: '', name: 'Hxlkart', link: 'https://vk.ru/artist/hxlkart_demo/', cover: 'https://cdn.example/artist.png' }])
    expect(vkArtistProfile('https://vk.ru/artist/hxlkart_demo?from=music')).toBe('https://vk.ru/artist/hxlkart_demo')
  })
})
