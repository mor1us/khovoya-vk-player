import type { ArtistSubscription } from '../../shared/types'

const origins = ['https://vk.ru', 'https://vk.com']

export function vkArtistsPage(userId: number): URL {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Войди в ВК, чтобы загрузить подписки')
  return new URL(`/audios${userId}?block=my_artists&section=all`, origins[0])
}

export function vkWebUrl(value: string): URL | undefined {
  try {
    const url = new URL(value)
    if (origins.includes(url.origin) && !url.username && !url.password) return url
  } catch { /* Это не ссылка ВК. */ }
}

export function vkArtistProfile(value: string): string | undefined {
  const url = vkWebUrl(value)
  if (url && /^\/artist\/[^/]+\/?$/.test(url.pathname)) return url.origin + url.pathname
}

type WebArtistCard = { href: string; name: string; image?: string }

// Функция выполняется в отдельном мире VK. Все зависимости передаются явно или берутся из страницы.
export function visibleArtists(root = document, style = getComputedStyle): WebArtistCard[] {
  const title = Array.from(root.querySelectorAll('h1,h2,h3,span,a,div,p,strong,button')).reverse().find((element) =>
    element.textContent?.trim() === 'Музыканты' && element.getClientRects().length)
  if (!title) return []
  const artistLinks = 'a[href*="/artist/"]'
  const imageUrl = (value: string | null | undefined) => {
    if (!value?.trim()) return
    try {
      const url = new URL(value, root.baseURI)
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
    } catch { return undefined }
  }

  for (let scope = title.parentElement; scope && scope !== root.body; scope = scope.parentElement) {
    const links = Array.from(scope.querySelectorAll<HTMLAnchorElement>(artistLinks)).filter((a) => a.getClientRects().length)
    if (!links.length) continue
    const paths = new Map(links.map((a) => [a, a.pathname.replace(/\/$/, '')]))
    return links.map((a) => {
      let card: Element = a
      // У ссылки с именем и аватара может быть общий контейнер. Соседних артистов не захватываем.
      for (let parent = a.parentElement; parent && parent !== scope; parent = parent.parentElement) {
        if (links.some((other) => paths.get(other) !== paths.get(a) && parent.contains(other))) break
        card = parent
      }
      let image: string | undefined
      const imgs = Array.from(card.querySelectorAll<HTMLImageElement>('img'))
      for (const img of imgs) {
        image = imageUrl(img.currentSrc) ?? imageUrl(img.getAttribute('data-src')) ?? imageUrl(img.getAttribute('src'))
        if (image) break
      }
      if (!image) {
        for (const node of [card, ...Array.from(card.querySelectorAll('*'))]) {
          const cssImage = style(node).backgroundImage.match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/i)
          image = imageUrl(cssImage?.[1] ?? cssImage?.[2] ?? cssImage?.[3])
          if (image) break
        }
      }
      return { href: a.href, name: a.innerText.trim() || a.getAttribute('aria-label') || a.title || a.querySelector('img')?.alt || '', image }
    })
  }
  return []
}

export function parseVkArtistCards(cards: WebArtistCard[]): ArtistSubscription[] {
  const artists = new Map<string, ArtistSubscription>()
  for (const { href, name: rawName, image } of cards) {
    const link = vkArtistProfile(href)
    const name = rawName.trim().replace(/\s+/g, ' ')
    if (!link) continue
    const key = new URL(link).pathname.replace(/\/$/, '')
    const previous = artists.get(key)
    artists.set(key, { id: '', name: name || previous?.name || '', link, cover: image?.startsWith('https://') ? image : previous?.cover })
  }
  return [...artists.values()].filter((artist) => artist.name)
}
