import type { Track, Playlist } from '../../shared/types'
import { normalizeIsrc, releaseDateOf } from '../../shared/trackMetadata'

type Thumb = { photo_300?: string; photo_600?: string; photo_1200?: string; photo_270?: string; photo_135?: string }
const best = (t?: Thumb) => t && (t.photo_600 ?? t.photo_1200 ?? t.photo_300 ?? t.photo_270 ?? t.photo_135)

export function vkFlag(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
}

function vkNonNegativeInteger(value: unknown): number | undefined {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (typeof number === 'number' && Number.isSafeInteger(number) && number >= 0) return number
}

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
    addedAt: vkNonNegativeInteger(r.date) || undefined,
    releaseDate: releaseDateOf(r.release_date),
    isrc: normalizeIsrc(r.isrc),
    plays: vkNonNegativeInteger(r.play_count),
    // Список может не отдать ссылку. В таком случае получим её отдельно при запуске.
    available: !r.content_restricted,
    ...(r.album?.id && r.album?.owner_id ? { album: { id: Number(r.album.id), ownerId: Number(r.album.owner_id), accessKey: r.album.access_key, title: String(r.album.title ?? 'Альбом') } } : {}),
    ...(Array.isArray(r.main_artists) && r.main_artists.length ? { artists: r.main_artists.filter((a: any) => a?.id && a?.name).map((a: any) => {
      const followed = vkFlag(a.is_followed ?? a.is_following)
      return { id: String(a.id), name: String(a.name), ...(followed !== undefined ? { followed } : {}) }
    }) } : {})
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
