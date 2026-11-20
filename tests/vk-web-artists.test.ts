import { describe, expect, it } from 'vitest'
import { parseVkArtistCards, visibleArtists, vkArtistProfile, vkArtistsPage } from '../src/main/vk/webArtistsLogic'

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

  it('соединяет фото и имя из разных ссылок и не стирает фото неполным ответом', () => {
    const href = 'https://vk.ru/artist/hxlkart_demo'
    const image = 'https://cdn.example/avatar.jpg'
    expect(parseVkArtistCards([
      { href, name: '', image },
      { href, name: 'Hxlkart' },
      { href, name: 'Hxlkart', image: 'data:image/png;base64,test' }
    ])).toEqual([{ id: '', name: 'Hxlkart', link: href, cover: image }])
  })

  it('читает фоновый аватар из контейнера карточки и не берёт изображение соседа', () => {
    const scope = { parentElement: null, querySelectorAll: () => links }
    const title = { textContent: 'Музыканты', parentElement: scope, getClientRects: () => [1] }
    const avatar = {}
    const card = {
      parentElement: scope,
      contains: (other: unknown) => other === links[0],
      querySelectorAll: (selector: string) => selector === '*' ? [avatar, links[0]] : []
    }
    const link = (name: string, parentElement: unknown) => ({
      href: 'https://vk.ru/artist/' + name, pathname: '/artist/' + name, innerText: name, parentElement,
      getClientRects: () => [1], querySelectorAll: () => []
    })
    const links = [link('Hxlkart', card), link('ximora', scope)]
    const document = { baseURI: 'https://vk.ru/', body: {}, querySelectorAll: () => [title] } as unknown as Document
    const style = (node: Element) => ({ backgroundImage: node === avatar ? 'url("//cdn.example/hxlkart.jpg")' : 'none' }) as CSSStyleDeclaration
    expect(visibleArtists(document, style).map(({ name, image }) => [name, image])).toEqual([
      ['Hxlkart', 'https://cdn.example/hxlkart.jpg'],
      ['ximora', undefined]
    ])
  })
})
