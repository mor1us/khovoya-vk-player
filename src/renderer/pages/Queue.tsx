import { useMemo } from 'react'
import { usePlayer, player } from '../store/playerInstance'
import { useUi } from '../store/ui'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { TrackRow } from '../ui/TrackRow'
import { Cover } from '../ui/Cover'
import { sourceParts } from '../ui/source'
import { canOpenSource, openSource } from '../store/sourceNav'
import { plural } from '../ui/format'
import * as I from '../ui/icons'

/** «Сейчас играет из …» и «Далее в очереди». Нажатие на трек — переход к нему в очереди. */
export function Queue() {
  const cur = usePlayer((s) => s.current)
  const source = usePlayer((s) => s.source)
  const rev = usePlayer((s) => s.rev)
  const queue = usePlayer((s) => s.queue)
  const next = useMemo(() => {
    if (!queue) return []
    return queue.list().slice(queue.currentIndex() + 1).filter((t) => t.available)
  }, [queue, rev, cur?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const { kind, name } = sourceParts(source)
  const link = canOpenSource(source)
  return (
    <div className="page fill queue">
      <div className="qh">
        {cur && <Cover className="qcv" url={cur.coverUrl} seed={cur.id} />}
        <div style={{ minWidth: 0 }}>
          <div className="qk">{source ? `СЕЙЧАС ИГРАЕТ ИЗ ${kind.toUpperCase()}` : 'ОЧЕРЕДЬ'}</div>
          {source
            ? <button className={'qn' + (link ? '' : ' nolink')} disabled={!link} title={link ? 'Перейти' : undefined} onClick={() => openSource(source)}>{name}{link && <span className="ar">→</span>}</button>
            : <div className="qn nolink">Пусто</div>}
        </div>
        <span className="sp" />
        <button className="ic qclose" title="Назад" onClick={() => useUi.getState().back()}><I.IX size={18} /></button>
      </div>
      {cur ? (
        <>
          <div className="rows qcur"><TrackRow track={cur} index={0} why="играет сейчас" onPlay={() => void player.getState().toggle()} /></div>
          <div className="h" style={{ margin: '18px 0 8px' }}><h3>Далее в очереди</h3><span className="muted" style={{ font: '500 11px var(--M)' }}>{next.length} {plural(next.length, 'трек', 'трека', 'треков')}</span></div>
          {next.length
            ? <VirtualTrackList tracks={next} showSrc onPlay={(t) => void player.getState().jump(t.id)} />
            : <div className="empty-state">Дальше ничего. Включи Волну — она не кончается.</div>}
        </>
      ) : <div className="empty-state">Ничего не играет. Включи Волну или любой трек.</div>}
    </div>
  )
}
