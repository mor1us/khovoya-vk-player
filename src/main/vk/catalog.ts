import type { Playlist } from '../../shared/types'
import { mapPlaylist } from './models'

export type ForYouBlock = { title: string; big: boolean; playlists: Playlist[] }

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
      .filter((raw: any) => raw.owner_id !== myId)
      .map((raw: any) => {
        const p = mapPlaylist(raw, myId)
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
