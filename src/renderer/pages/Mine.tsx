import { useMemo, useState } from 'react'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { moveItem } from '../store/playlistLogic'
import { plural } from '../ui/format'
import * as I from '../ui/icons'

export function Mine() {
  const mine = useLibrary((s) => s.mine)
  const loaded = useLibrary((s) => s.mineLoaded)
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? mine.filter((t) => (t.artist + ' ' + t.title).toLowerCase().includes(s)) : mine
  }, [mine, q])
  const playAll = (shuffle: boolean) => {
    if (shuffle !== player.getState().shuffle) player.getState().toggleShuffle()
    const avail = list.filter((t) => t.available)
    if (!avail.length) return
    const first = shuffle ? avail[Math.floor(Math.random() * avail.length)] : avail[0]
    void player.getState().playList(list, first.id, 'mine')
  }
  async function reorder(id: string, to: number) {
    const mv = moveItem(mine.map((t) => t.id), id, to)
    const map = new Map(mine.map((t) => [t.id, t]))
    const track = map.get(id)
    if (!track) return
    const prev = mine
    useLibrary.getState().setMine(mv.list.map((x) => map.get(x)!))
    try { await window.api.invoke('pl:reorder', track, mv.before, mv.after) }
    catch { useLibrary.getState().setMine(prev); useUi.getState().toast('ВК не дал поменять порядок') }
  }
  return (
    <div className="page fill">
      <div className="ph">
        <h1>Моя музыка</h1><span className="cnt">{mine.length} {plural(mine.length, 'трек', 'трека', 'треков')}</span>
        <span className="sp" />
        <input className="filter" placeholder="Поиск в моей музыке" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-s" onClick={() => playAll(false)}><I.IPlay size={14} />Играть</button>
        <button className="btn-s g" onClick={() => playAll(true)}><I.IShuffle size={14} />Перемешать всё</button>
      </div>
      {!loaded ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" />)
        : list.length ? <VirtualTrackList tracks={list} onPlay={(t) => void player.getState().playList(list, t.id, 'mine')} onReorder={q ? undefined : reorder} />
        : <div className="empty-state">{q ? 'Ничего не нашлось' : 'Здесь появятся треки, которые ты добавишь'}</div>}
    </div>
  )
}
