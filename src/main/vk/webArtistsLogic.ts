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

export function parseVkArtistCards(cards: { href: string; name: string; image?: string }[]): ArtistSubscription[] {
  const artists = new Map<string, ArtistSubscription>()
  for (const { href, name: rawName, image } of cards) {
    const link = vkArtistProfile(href)
    const name = rawName.trim().replace(/\s+/g, ' ')
    if (!link || !name) continue
    const key = new URL(link).pathname.replace(/\/$/, '')
    artists.set(key, { id: '', name, link, cover: image?.startsWith('https://') ? image : undefined })
  }
  return [...artists.values()]
}
