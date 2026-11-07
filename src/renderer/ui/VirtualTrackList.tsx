import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Playlist, Track } from '../../shared/types'
import { TrackRow } from './TrackRow'
import { useSelection } from './useSelection'

/**
 * Длинный список: рисуются только видимые строки, поэтому тысячи треков не тормозят.
 * Обычно список прокручивается сам. Если над ним на странице много всего (ряды плейлистов,
 * карточки), передай `scroller` — тогда список живёт в общей прокрутке страницы и до него
 * можно долистать, а не упираться в сплющенный до нуля блок.
 */
export function VirtualTrackList({ tracks, onPlay, ctxPlaylist, onReorder, showSrc, scroller }: {
  tracks: Track[]; onPlay: (t: Track) => void; ctxPlaylist?: Playlist; onReorder?: (id: string, to: number) => void; showSrc?: boolean
  scroller?: RefObject<HTMLElement | null>
}) {
  const parent = useRef<HTMLDivElement>(null)
  /** Насколько список смещён от начала общей прокрутки — без этого виртуализатор считает строки не на тех местах. */
  const [margin, setMargin] = useState(0)
  const shared = !!scroller
  useLayoutEffect(() => {
    if (!shared) return
    const measure = () => {
      const el = parent.current, sc = scroller?.current
      if (!el || !sc) return
      const next = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
      setMargin((prev) => (Math.abs(prev - next) > 0.5 ? next : prev))
    }
    measure()
    const sc = scroller?.current
    sc?.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    if (sc) ro.observe(sc)
    window.addEventListener('resize', measure)
    return () => { sc?.removeEventListener('scroll', measure); ro.disconnect(); window.removeEventListener('resize', measure) }
  })
  const v = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => (shared ? scroller?.current ?? null : parent.current),
    estimateSize: () => 58,
    overscan: 12,
    scrollMargin: shared ? margin : 0
  })
  const { sel, selected, onSelect } = useSelection(tracks)
  const box = shared ? {} : { flex: 1, minHeight: 0, overflow: 'auto' as const, marginRight: -12, paddingRight: 12 }
  return (
    <div ref={parent} style={box}>
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((it) => {
          const t = tracks[it.index]
          return (
            <div key={t.id} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${it.start - (shared ? margin : 0)}px)` }}>
              <TrackRow track={t} index={it.index} showSrc={showSrc} selected={sel.has(t.id)} selection={selected} ctxPlaylist={ctxPlaylist}
                onPlay={() => onPlay(t)} onSelect={(e) => onSelect(t, e)}
                onDragOver={onReorder ? (e) => { if (e.dataTransfer.types.includes('text/track-ids')) e.preventDefault() } : undefined}
                onDrop={onReorder ? (e) => { const ids = JSON.parse(e.dataTransfer.getData('text/track-ids') || '[]') as string[]; if (ids.length === 1) onReorder(ids[0], it.index) } : undefined} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
