import type { Playlist, Track } from '../../shared/types'
import { Cover } from './Cover'
import { fmtTime } from './format'
import { usePlayer } from '../store/playerInstance'
import { useDownloads } from '../store/downloads'
import { openTrackMenu } from './TrackMenu'
import * as I from './icons'
import { useState } from 'react'
import { useLibrary } from '../store/library'
import { useSc } from '../store/sc'
import { useWave } from '../store/wave'
import { useUi } from '../store/ui'

export type RowProps = {
  track: Track
  index?: number
  why?: string
  selected?: boolean
  compact?: boolean
  /** Показать значок источника (ВК / SoundCloud) — в поиске. */
  showSrc?: boolean
  ctxPlaylist?: Playlist
  selection?: Track[]
  draggable?: boolean
  onPlay: () => void
  onSelect?: (e: React.MouseEvent) => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

/** Значок источника: свой рисунок, не логотипы сервисов. */
export function SrcBadge({ src }: { src: 'vk' | 'sc' }) {
  return src === 'sc'
    ? <span className="srcb sc" title="SoundCloud">SC</span>
    : <span className="srcb vk" title="ВКонтакте">ВК</span>
}

export function TrackRow(p: RowProps) {
  const t = p.track
  const isCur = usePlayer((s) => s.current?.id === t.id)
  const done = useDownloads((s) => s.done.has(t.id))
  const liked = useLibrary((s) => (t.src !== 'sc' ? s.mine.some((x) => x.id === t.id) : false))
  const scLiked = useSc((s) => (t.src === 'sc' ? s.likes.some((x) => x.id === t.id) || s.accLikes.some((x) => x.id === t.id) : false))
  const isLiked = liked || scLiked
  const [pop, setPop] = useState(0)
  const like = (e: React.MouseEvent) => {
    e.stopPropagation(); setPop(Date.now())
    const sc = t.src === 'sc'
    const was = useWave.getState().isLiked(t)
    void useWave.getState().toggleLike(t)
      .then((m) => useUi.getState().toast(m, was
        ? { label: 'Вернуть', run: () => void useWave.getState().toggleLike(t).then((x) => useUi.getState().toast(x)).catch(() => {}) }
        : { label: 'Открыть', run: () => useUi.getState().go(sc ? 'soundcloud' : 'mine') }))
      .catch((er) => useUi.getState().toast((er as Error).message))
  }
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
        <div className="tt">{p.showSrc && <SrcBadge src={t.src === 'sc' ? 'sc' : 'vk'} />}{t.title}</div>
        <div className="ar">{t.artist}</div>
        {p.why && <div className="why">{p.why}</div>}
      </div>
      {!p.compact && <div className={'acts' + (done || isLiked ? ' keep' : '')}>
        <button key={pop} className={'ic heart' + (isLiked ? ' on' : ' hov') + (pop ? ' pop' : '')} title={isLiked ? (t.src === 'sc' ? 'Убрать из лайков SoundCloud' : 'Убрать из «Моё»') : (t.src === 'sc' ? 'Нравится — в лайки SoundCloud' : 'Нравится — в «Моё»')} onClick={like}><I.IHeart size={15} on={isLiked} /></button>
        <button className="ic" title="Играть" onClick={(e) => { e.stopPropagation(); if (t.available) p.onPlay() }}><I.IPlay size={14} /></button>
        <button className={'ic' + (done ? ' dl' : '')} title={done ? 'Скачан' : 'Скачать'} onClick={(e) => { e.stopPropagation(); if (!done) void useDownloads.getState().start([t]) }}>{done ? <I.ICheck size={16} /> : <I.IDown size={16} />}</button>
      </div>}
      <span className="d">{fmtTime(t.duration)}</span>
      <button className="ic" title="Ещё" onClick={(e) => openTrackMenu(e, [t], p.ctxPlaylist)}><I.IMore size={16} /></button>
    </div>
  )
}
