import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Playlist, Track } from '../../shared/types'
import { TrackRow } from './TrackRow'
import { useSelection } from './useSelection'

/** Длинный список: рисуются только видимые строки, поэтому тысячи треков не тормозят. */
export function VirtualTrackList({ tracks, onPlay, ctxPlaylist, onReorder, showSrc }: {
  tracks: Track[]; onPlay: (t: Track) => void; ctxPlaylist?: Playlist; onReorder?: (id: string, to: number) => void; showSrc?: boolean
}) {
  const parent = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({ count: tracks.length, getScrollElement: () => parent.current, estimateSize: () => 58, overscan: 12 })
  const { sel, selected, onSelect } = useSelection(tracks)
  return (
    <div ref={parent} style={{ flex: 1, minHeight: 0, overflow: 'auto', marginRight: -12, paddingRight: 12 }}>
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((it) => {
          const t = tracks[it.index]
          return (
            <div key={t.id} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${it.start}px)` }}>
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
