import type { Track, Playlist } from '../../shared/types'

type Thumb = { photo_300?: string; photo_600?: string; photo_1200?: string; photo_270?: string; photo_135?: string }
const best = (t?: Thumb) => t && (t.photo_600 ?? t.photo_1200 ?? t.photo_300 ?? t.photo_270 ?? t.photo_135)

export function mapTrack(r: any): Track {
  return {
    id: `${r.owner_id}_${r.id}`,
    ownerId: r.owner_id,
    vkId: r.id,
    accessKey: r.access_key,
    title: String(r.title ?? '').trim() || 'Без названия',
    artist: String(r.artist ?? '').trim() || 'Неизвестен',
    duration: Number(r.duration) || 0,
    url: r.url ?? '',
    coverUrl: best(r.album?.thumb),
    addedAt: r.date,
    available: Boolean(r.url) && !r.content_restricted,
    ...(Array.isArray(r.main_artists) && r.main_artists.length ? { artists: r.main_artists.filter((a: any) => a?.id && a?.name).map((a: any) => ({ id: String(a.id), name: String(a.name) })) } : {})
  }
}

export function mapPlaylist(r: any, myId: number): Playlist {
  const orig = r.original
  const covers: string[] = []
  if (Array.isArray(r.thumbs)) for (const t of r.thumbs) { const u = best(t); if (u) covers.push(u) }
  if (!covers.length) { const u = best(r.photo); if (u) covers.push(u) }
  return {
    id: orig ? orig.playlist_id : r.id,
    ownerId: orig ? orig.owner_id : r.owner_id,
    accessKey: orig ? orig.access_key : r.access_key,
    title: r.title ?? 'Без названия',
    count: r.count ?? 0,
    coverUrls: covers,
    isMine: !orig && r.owner_id === myId,
    updatedAt: r.update_time ?? 0
  }
}
