import { useEffect, useState } from 'react'
import type { Track } from '../../shared/types'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { player } from '../store/playerInstance'
import { TrackRow } from '../ui/TrackRow'
import { Cover } from '../ui/Cover'
import { artistWhy } from '../store/artistsLogic'
import * as I from '../ui/icons'

/** Экран исполнителя: его треки, новые сверху. Сюда попадают из блока «Новое у твоих артистов». */
export function Artist() {
  const a = useUi((s) => s.artist)
  const mine = useLibrary((s) => s.mine)
  const [list, setList] = useState<Track[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!a) return
    let alive = true
    setList(null); setFailed(false)
    window.api.invoke('vk:artistTracks', { id: a.id, name: a.name })
      .then((r) => { if (alive) setList(r) })
      .catch(() => { if (alive) { setList([]); setFailed(true) } })
    return () => { alive = false }
  }, [a?.id, a?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return <div className="page"><div className="empty-state">Выбери исполнителя на главной</div></div>
  const own = new Set(mine.map((t) => t.id))
  const now = Date.now()
  const can = list?.filter((t) => t.available) ?? []
  const play = (id: string) => void player.getState().playList(can, id, `artist:${a.name}`)
  return (
    <div className="page">
      <button className="back" onClick={() => useUi.getState().back()}><I.IBack size={16} />Назад</button>
      <div className="ph">
        <Cover className="av" url={a.cover} seed={a.name} />
        <h1>{a.name}</h1>
        {!!list?.length && <span className="cnt">{list.length} ТРЕКОВ</span>}
        <span className="sp" />
        <button className="btn-s" onClick={() => useUi.getState().submit(a.name)}>Искать везде</button>
        {!!can.length && <button className="btn-s g" onClick={() => play(can[0].id)}><I.IPlay size={14} />Слушать</button>}
      </div>
      {list === null && <div className="rows">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />)}</div>}
      {list?.length === 0 && <div className="empty-state">{failed ? 'ВК не ответил. Попробуй ещё раз чуть позже' : `У ${a.name} тут ничего не нашлось`}</div>}
      {!!list?.length && <div className="rows">{list.map((t, i) => <TrackRow key={t.id} track={t} why={artistWhy(t, own, now)} index={i} onPlay={() => play(t.id)} />)}</div>}
    </div>
  )
}
