import type { ArtistSubscription, ForYouBlock } from '../../shared/types'
import { mapPlaylist, vkFlag } from './models'

const list = (value: any): any[] => Array.isArray(value) ? value : []
const sectionsOf = (payload: any) => list(payload?.catalog?.sections)
const blocksOf = (payload: any) => [
  ...list(payload?.section?.blocks),
  ...list(payload?.blocks),
  ...sectionsOf(payload).flatMap((section) => list(section?.blocks))
]

/** Идентификатор раздела приходит из каталога текущего аккаунта. */
export function subscriptionSection(payload: any): string | undefined {
  const sections = sectionsOf(payload)
  const blocks = blocksOf(payload)
  const entries = [...sections, ...blocks, ...[...sections, ...blocks].flatMap((entry) => list(entry?.actions)), ...list(payload?.links)]
  const titles = /^(?:подписки|мои подписки|артисты и кураторы|мои артисты|подписки на артистов|following|subscriptions)$/i
  for (const entry of entries) {
    const title = String(entry?.title ?? entry?.layout?.title ?? entry?.text ?? entry?.action?.title ?? '').trim()
    if (!titles.test(title)) continue
    const actions = list(entry.actions).filter((a) => (a?.action?.type ?? a?.type) === 'open_section')
    const candidates = [entry.section_id, entry.action?.section_id, entry.meta?.show_all_info?.section_id, entry.default_section,
      ...actions.flatMap((a) => [a.section_id, a.action?.section_id]), sections.includes(entry) ? entry.id : undefined]
    const id = candidates.find((value) => typeof value === 'string' && value.trim())
    if (id) return id
  }
}

export function subscriptionCatalogShape(payload: any): string {
  const sections = sectionsOf(payload)
  const blocks = blocksOf(payload)
  const actions = [...sections, ...blocks].flatMap((entry) => list(entry?.actions))
  return `вкладок ${sections.length}, блоков ${blocks.length}, действий ${actions.length}, ссылок ${list(payload?.links).length}, артистов ${list(payload?.artists).length}`
}

export function subscriptionArtists(payload: any): ArtistSubscription[] {
  const artists: ArtistSubscription[] = []
  for (const artist of Array.isArray(payload?.artists) ? payload.artists : []) {
    if (artist?.id == null || typeof artist?.name !== 'string' || !artist.name.trim()) continue
    if (vkFlag(artist.is_following ?? artist.is_followed ?? artist.is_subscribed) === false) continue
    const cover = Array.isArray(artist.photo) ? artist.photo.at(-1)?.url : undefined
    artists.push({ id: String(artist.id), name: artist.name.trim(), cover })
  }
  for (const link of Array.isArray(payload?.links) ? payload.links : []) {
    const id = link?.artist_id ?? link?.action?.artist_id
    if (link?.content_type !== 'artist' || id == null || typeof link.title !== 'string' || !link.title.trim()) continue
    if (vkFlag(link.is_following ?? link.is_followed ?? link.is_subscribed) === false) continue
    artists.push({ id: String(id), name: link.title.trim(), cover: link.images?.at(-1)?.url })
  }
  return artists
}

export function artistSubscriptionState(payload: any, artistId: string): boolean | undefined {
  const blocks = payload?.section?.blocks ?? payload?.blocks ?? []
  const toggle = blocks.flatMap((block: any) => block?.actions ?? []).find((action: any) => (
    action?.action?.type === 'toggle_artist_subscription' && String(action.artist_id ?? action.entity_id) === artistId
  ))
  const value = toggle?.is_following ?? payload?.is_followed ?? payload?.artist?.is_followed ?? payload?.artist?.is_subscribed
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
}

export type { ForYouBlock }

/** Каталог музыки ВК (catalog.getAudio): берём блоки с плейлистами — «Собрано алгоритмами», плейлисты дня и т.п. */
export function parseCatalog(resp: any, myId: number): ForYouBlock[] {
  if (!resp || typeof resp !== 'object') return []
  const byKey = new Map<string, any>()
  for (const p of Array.isArray(resp.playlists) ? resp.playlists : []) byKey.set(`${p.owner_id}_${p.id}`, p)
  const blocks: any[] = [
    ...(Array.isArray(resp.blocks) ? resp.blocks : []),
    ...((resp.catalog?.sections ?? []) as any[]).flatMap((s) => (Array.isArray(s?.blocks) ? s.blocks : []))
  ]
  const out: ForYouBlock[] = []
  let header: string | null = null
  for (const b of blocks) {
    if (b?.data_type !== 'music_playlists' || !Array.isArray(b.playlists_ids)) {
      // Заголовки у ВК — отдельные блоки перед подборкой
      if (typeof b?.layout?.title === 'string' && b.layout.title.trim()) header = b.layout.title.trim()
      continue
    }
    const playlists = b.playlists_ids
      .map((id: string) => byKey.get(String(id).split('_').slice(0, 2).join('_')))
      .filter(Boolean)
      // «Плейлисты дня» ВК создаёт от имени самого пользователя — не выкидываем их, но и редактировать не даём
      .map((raw: any) => {
        const p = { ...mapPlaylist(raw, myId), isMine: false }
        const sub = raw.description || raw.subtitle
        return typeof sub === 'string' && sub.trim() ? { ...p, subtitle: sub.trim() } : p
      })
    const title = (typeof b.layout?.title === 'string' && b.layout.title.trim()) || header || 'Для вас'
    header = null
    if (!playlists.length) continue
    out.push({ title, big: /large/.test(String(b.layout?.name ?? '')), playlists })
    if (out.length >= 8) break
  }
  return out
}

/** Короткая сводка каталога для журнала: какие блоки и плейлисты прислал ВК. */
export function catalogSummary(blocks: ForYouBlock[]): string {
  return blocks.map((b) => `«${b.title}»${b.big ? ' (крупно)' : ''}: ${b.playlists.slice(0, 8).map((p) => p.title).join(' | ')}`).join(' ;; ')
}
