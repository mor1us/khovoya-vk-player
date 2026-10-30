import type { Playlist, Track } from '../../shared/types'
import { Cover } from './Cover'
import { fmtTime } from './format'
import { usePlayer } from '../store/playerInstance'
import { useDownloads } from '../store/downloads'
import { openTrackMenu } from './TrackMenu'
import * as I from './icons'

export type RowProps = {
  track: Track
  index?: number
  why?: string
  selected?: boolean
  compact?: boolean
  ctxPlaylist?: Playlist
  selection?: Track[]
  draggable?: boolean
  onPlay: () => void
  onSelect?: (e: React.MouseEvent) => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

export function TrackRow(p: RowProps) {
  const t = p.track
  const isCur = usePlayer((s) => s.current?.id === t.id)
  const done = useDownloads((s) => s.done.has(t.id))
  const cls = 'row' + (isCur ? ' cur' : '') + (p.selected ? ' sel' : '') + (t.available ? '' : ' na')
  return (
    <div className={cls} draggable={p.draggable ?? t.available}
      onDragStart={(e) => { e.dataTransfer.setData('text/track-ids', JSON.stringify((p.selected && p.selection?.length ? p.selection : [t]).map((x) => x.id))); p.onDragStart?.(e) }}
      onDragOver={p.onDragOver} onDrop={p.onDrop}
      onClick={(e) => { if (e.ctrlKey || e.shiftKey) p.onSelect?.(e); else p.onSelect?.(e) }}
      onDoubleClick={() => t.available && p.onPlay()}
      onContextMenu={(e) => openTrackMenu(e, p.selected && p.selection?.length ? p.selection : [t], p.ctxPlaylist)}
      title={t.available ? undefined : 'Трек недоступен (изъят правообладателем)'}>
      {!p.compact && <span className="n">{isCur ? '▶' : p.index != null ? String(p.index + 1).padStart(2, '0') : ''}</span>}
      <Cover className="cv" url={t.coverUrl} seed={t.id} onClick={() => t.available && p.onPlay()} />
      <div style={{ minWidth: 0 }}>
        <div className="tt">{t.title}</div>
        <div className="ar">{t.artist}</div>
        {p.why && <div className="why">{p.why}</div>}
      </div>
      {!p.compact && <div className={'acts' + (done ? ' keep' : '')}>
        <button className="ic" title="Играть" onClick={(e) => { e.stopPropagation(); if (t.available) p.onPlay() }}><I.IPlay size={14} /></button>
        <button className={'ic' + (done ? ' dl' : '')} title={done ? 'Скачан' : 'Скачать'} onClick={(e) => { e.stopPropagation(); if (!done) void useDownloads.getState().start([t]) }}>{done ? <I.ICheck size={16} /> : <I.IDown size={16} />}</button>
      </div>}
      <span className="d">{fmtTime(t.duration)}</span>
      <button className="ic" title="Ещё" onClick={(e) => openTrackMenu(e, [t], p.ctxPlaylist)}><I.IMore size={16} /></button>
    </div>
  )
}
