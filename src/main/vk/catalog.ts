import type { Playlist } from '../../shared/types'
import { mapPlaylist } from './models'

export type ForYouBlock = { title: string; playlists: Playlist[] }

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
  for (const b of blocks) {
    if (b?.data_type !== 'music_playlists' || !Array.isArray(b.playlists_ids)) continue
    const playlists = b.playlists_ids
      .map((id: string) => byKey.get(String(id).split('_').slice(0, 2).join('_')))
      .filter(Boolean)
      .filter((raw: any) => raw.owner_id !== myId)
      .map((raw: any) => mapPlaylist(raw, myId))
    if (!playlists.length) continue
    out.push({ title: String(b.layout?.title ?? b.layout?.name ?? 'Для вас'), playlists })
    if (out.length >= 3) break
  }
  return out
}
