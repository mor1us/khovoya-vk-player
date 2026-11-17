import type { ArtistSubscription, ForYouBlock } from '../../shared/types'

/** Идентификатор раздела приходит из каталога текущего аккаунта. */
export function subscriptionSection(payload: any): string | undefined {
  const entries = [...(payload?.catalog?.sections ?? []), ...(payload?.section?.blocks ?? []), ...(payload?.links ?? [])]
  for (const entry of entries) {
    const title = String(entry?.title ?? entry?.layout?.title ?? '').trim()
    if (!/^(?:артисты и кураторы|мои артисты|подписки на артистов)$/i.test(title)) continue
    const id = entry.section_id ?? entry.action?.section_id ?? entry.default_section ?? (payload?.catalog?.sections?.includes(entry) ? entry.id : undefined)
    if (typeof id === 'string' && id) return id
  }
}

export function subscriptionArtists(payload: any): ArtistSubscription[] {
  const artists: ArtistSubscription[] = []
  for (const artist of Array.isArray(payload?.artists) ? payload.artists : []) {
    if (artist?.id == null || typeof artist?.name !== 'string' || !artist.name.trim()) continue
    const cover = Array.isArray(artist.photo) ? artist.photo.at(-1)?.url : undefined
    artists.push({ id: String(artist.id), name: artist.name.trim(), cover })
  }
  return artists
}

export type { ForYouBlock }
import { mapPlaylist } from './models'

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
