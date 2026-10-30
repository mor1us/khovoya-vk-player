import { useEffect, useState } from 'react'
import type { Track } from '../../shared/types'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { useWave } from '../store/wave'
import { usePlayer, player } from '../store/playerInstance'
import { Crates } from '../ui/Crates'
import { WaveCard } from '../ui/WaveCard'
import { TrackRow } from '../ui/TrackRow'
import { artistKey } from '../wave/profile'

function why(t: Track, base: Track | null, mine: Set<string>, weights: Record<string, number>): string {
  if ((weights[artistKey(t.artist)] ?? 0) >= 3) return 'ты лайкал этого артиста'
  if (base) return `похоже на «${base.title}»`
  if (!mine.has(t.id)) return 'новое для тебя'
  return 'из твоей музыки'
}

function Similar() {
  const cur = usePlayer((s) => s.current)
  const bg = useUi((s) => s.background)
  const mine = useLibrary((s) => s.mine)
  const weights = useWave((s) => s.profile.artists)
  const [list, setList] = useState<Track[] | null>(null)
  const [base, setBase] = useState<Track | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (bg) return
    let alive = true
    const target = cur
    window.api.invoke<Track[]>('vk:recommendations', target?.id, 30)
      .then((r) => {
        if (!alive) return
        const own = new Set(mine.map((t) => t.id))
        const fresh = r.filter((t) => t.available && t.id !== target?.id)
        const pick = [...fresh.filter((t) => !own.has(t.id)), ...fresh.filter((t) => own.has(t.id))]
        const start = (tick * 4) % Math.max(1, pick.length - 3)
        setList(pick.slice(start, start + 4)); setBase(target)
      })
      .catch(() => alive && setList([]))
    return () => { alive = false }
  }, [cur?.id, bg, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const own = new Set(mine.map((t) => t.id))
  return (
    <div className="box">
      <h3>Похоже на это <button onClick={() => setTick(tick + 1)}>Ещё →</button></h3>
      <div className="rows compact" style={{ marginTop: 12 }}>
        {list === null && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}
        {list?.length === 0 && <div className="empty-state">Рекомендации пока недоступны</div>}
        {list?.map((t) => <TrackRow key={t.id} compact track={t} why={why(t, base, own, weights)} onPlay={() => void player.getState().playList(list, t.id, 'similar')} />)}
      </div>
    </div>
  )
}

function ForYouRows() {
  const forYou = useLibrary((s) => s.forYou)
  useEffect(() => { void useLibrary.getState().loadForYou() }, [])
  if (forYou === null) return <><div className="h"><h3>Для вас</h3></div><div className="crates">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="crate"><div className="skeleton" style={{ height: 118, width: 118 }} /></div>)}</div></>
  return <>{forYou.map((b) => (
    <div key={b.title} style={{ marginBottom: 18 }}>
      <div className="h"><h3>{b.title}</h3><span className="muted" style={{ font: '500 11px var(--M)' }}>ДЛЯ ВАС</span></div>
      <Crates list={b.playlists.slice(0, 12)} />
    </div>))}</>
}

export function Home() {
  const playlists = useLibrary((s) => s.playlists)
  return (
    <div className="home">
      <ForYouRows />
      <div className="h"><h3>Мои плейлисты</h3><button className="link" onClick={() => useUi.getState().go('playlists')}>Все {playlists.length} →</button></div>
      {playlists.length ? <Crates list={playlists.slice(0, 12)} /> : <div className="empty-state">Плейлистов пока нет</div>}
      <div className="bento"><WaveCard /><Similar /></div>
    </div>
  )
}
