import type { Playlist } from '../../shared/types'

/** Плейлисты дня от ВК («Плейлист дня 1…5») вместе с нашими миксами. Подборки редакции не показываем. */
export function dailyOnly(blocks: { playlists: Playlist[] }[]): Playlist[] {
  const seen = new Set<string>()
  return blocks.flatMap((b) => b.playlists).filter((p) => {
    const k = `${p.ownerId}_${p.id}`
    if (seen.has(k) || !/плейлист\s*дня|микс\s*дня|дневн|daily|of\s+the\s+day/i.test(p.title)) return false
    seen.add(k); return true
  })
}
