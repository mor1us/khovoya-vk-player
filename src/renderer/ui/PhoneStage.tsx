import { useRef, useState } from 'react'
import { usePlayer, player } from '../store/playerInstance'
import { useUi } from '../store/ui'
import { Cover } from './Cover'
import { Waveform } from './Waveform'
import { ScComments } from './ScComments'
import { Controls, usePosition } from './Stage'
import { fmtTime } from './format'
import { sourceLabel } from './source'
import { openTrackMenu } from './TrackMenu'
import * as I from './icons'

/**
 * Плеер на телефоне: полоска над нижней панелью, по нажатию раскрывается на весь экран.
 * Свайп вниз сворачивает обратно.
 */
export function PhoneStage() {
  const cur = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const source = usePlayer((s) => s.source)
  const duration = usePlayer((s) => s.duration)
  const pos = usePosition()
  const [open, setOpen] = useState(false)
  const from = useRef(0)
  const dur = duration || cur?.duration || 0
  if (!cur) return null

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { from.current = e.touches[0].clientY },
    onTouchEnd: (e: React.TouchEvent) => { if (e.changedTouches[0].clientY - from.current > 70) setOpen(false) }
  }

  if (!open) return (
    <div className="pmini" onClick={() => setOpen(true)}>
      <Cover className="cv" url={cur.coverUrl} seed={cur.id} />
      <div className="tx">
        <div className="tt">{cur.title}</div>
        <div className="ar">{cur.artist}</div>
      </div>
      <button className="pplay" aria-label={playing ? 'Пауза' : 'Играть'} onClick={(e) => { e.stopPropagation(); void player.getState().toggle() }}>
        {playing ? <I.IPause size={22} /> : <I.IPlay size={22} />}
      </button>
      <button className="pic" aria-label="Вперёд" onClick={(e) => { e.stopPropagation(); void player.getState().next() }}><I.INext size={22} /></button>
      <i className="pprog" style={{ width: `${dur ? (pos / dur) * 100 : 0}%` }} />
    </div>
  )

  return (
    <div className="pfull" {...swipe}>
      <div className="ptop">
        <button className="pic" aria-label="Свернуть" onClick={() => setOpen(false)}><I.IBack size={22} /></button>
        <div className="src">{source ? sourceLabel(source) : 'Хвоя'}</div>
        <button className="pic" aria-label="Ещё" onClick={(e) => openTrackMenu(e, [cur])}><I.IMore size={22} /></button>
      </div>

      <Cover className="pcover" url={cur.coverUrl} seed={cur.id} />

      <div className="pname">
        <div className="tt">{cur.title}</div>
        <div className="ar">{cur.artist}</div>
      </div>

      <ScComments track={cur} pos={pos} />
      <Waveform id={cur.id} track={cur} n={48} progress={dur ? pos / dur : 0} onSeek={(f) => player.getState().seek(f * dur)} className="pwf" />
      <div className="ptimes"><span>{fmtTime(pos)}</span><span>{fmtTime(dur)}</span></div>

      <div className="pctl"><Controls reactions /></div>

      <button className="pqueue" onClick={() => { setOpen(false); useUi.getState().go('queue') }}><I.IList size={18} />Очередь</button>
    </div>
  )
}
