import { useEffect, useState } from 'react'
import type { Track } from '../../shared/types'
import { useLibrary } from '../store/library'
import { useWave } from '../store/wave'
import { usePlayer, player } from '../store/playerInstance'
import { TrackRow } from '../ui/TrackRow'
import { artistKey } from '../wave/profile'
import * as I from '../ui/icons'

function why(t: Track, base: Track | null, mine: Set<string>, weights: Record<string, number>): string {
  if ((weights[artistKey(t.artist)] ?? 0) >= 3) return 'ты лайкал этого артиста'
  if (!mine.has(t.id)) return base ? '' : 'новое для тебя' // «похоже на …» уже написано в заголовке страницы
  return 'из твоей музыки'
}

/** «Похожее» на то, что играет сейчас (или на твой вкус, если ничего не играет). */
export function Similar() {
  const cur = usePlayer((s) => s.current)
  const mine = useLibrary((s) => s.mine)
  const weights = useWave((s) => s.profile.artists)
  const [list, setList] = useState<Track[] | null>(null)
  const [base, setBase] = useState<Track | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    const target = cur
    setList(null)
    const req = target?.src === 'sc' ? window.api.invoke('sc:related', target) : window.api.invoke('vk:recommendations', target?.id, 60)
    req
      .then((r) => {
        if (!alive) return
        const own = new Set(mine.map((t) => t.id))
        const fresh = r.filter((t) => t.available && t.id !== target?.id)
        const pick = [...fresh.filter((t) => !own.has(t.id)), ...fresh.filter((t) => own.has(t.id))]
        const start = (tick * 20) % Math.max(1, pick.length - 19)
        setList(pick.slice(start, start + 20)); setBase(target)
      })
      .catch(() => alive && setList([]))
    return () => { alive = false }
  }, [cur?.id, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const own = new Set(mine.map((t) => t.id))
  const play = (id: string) => list && void player.getState().playList(list, id, 'similar')
  return (
    <div className="page">
      <div className="ph">
        <h1>Похожее</h1><span className="cnt">{base ? `на «${base.title}»` : 'на твой вкус'}</span><span className="sp" />
        <button className="btn-s" disabled={tick === 0} onClick={() => setTick(Math.max(0, tick - 1))}>‹ Назад</button>
        <button className="btn-s" onClick={() => setTick(tick + 1)}>Другие ›</button>
        {!!list?.length && <button className="btn-s g" onClick={() => play(list[0].id)}><I.IPlay size={14} />Слушать</button>}
      </div>
      {list === null && <div className="rows">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />)}</div>}
      {list?.length === 0 && <div className="empty-state">Рекомендации пока недоступны</div>}
      {!!list?.length && <div className="rows">{list.map((t, i) => <TrackRow key={t.id} track={t} showSrc why={why(t, base, own, weights)} index={i} onPlay={() => play(t.id)} />)}</div>}
    </div>
  )
}
