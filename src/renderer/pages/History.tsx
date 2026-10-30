import { useMemo } from 'react'
import { useHistory } from '../store/history'
import { groupByDay } from '../store/historyLogic'
import { player } from '../store/playerInstance'
import { TrackRow } from '../ui/TrackRow'
import { confirmAsk } from '../ui/Dialog'
import { plural } from '../ui/format'
import * as I from '../ui/icons'

const hhmm = (t: number) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

export function History() {
  const items = useHistory((s) => s.items)
  const groups = useMemo(() => groupByDay(items, Date.now()), [items])
  const tracks = useMemo(() => items.map((e) => e.track), [items])
  const play = (id: string) => void player.getState().playList(tracks, id, 'history')
  return (
    <div className="page">
      <div className="ph">
        <h1>История</h1><span className="cnt">{items.length} {plural(items.length, 'трек', 'трека', 'треков')}</span><span className="sp" />
        {items.length > 0 && <button className="btn-s" onClick={async () => { if (await confirmAsk('Очистить историю прослушивания?', 'Очистить', true)) useHistory.getState().clear() }}>Очистить</button>}
        {items.length > 0 && <button className="btn-s g" onClick={() => play(tracks[0].id)}><I.IPlay size={14} />Слушать заново</button>}
      </div>
      {!items.length && <div className="empty-state">Здесь будут треки, которые ты слушал.</div>}
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div className="h"><h3>{g.label}</h3></div>
          <div className="rows">{g.items.map((e, i) => <TrackRow key={e.track.id + e.at} track={e.track} why={hhmm(e.at)} index={i} onPlay={() => play(e.track.id)} />)}</div>
        </div>
      ))}
    </div>
  )
}
