import { useEffect, useState } from 'react'
import type { Track } from '../../shared/types'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { useWave } from '../store/wave'
import { usePlayer, player } from '../store/playerInstance'
import { Crates, Crate } from '../ui/Crates'
import { WaveCard } from '../ui/WaveCard'
import { Cover } from '../ui/Cover'
import { openTrackMenu } from '../ui/TrackMenu'
import { ArtistsBox } from '../ui/ArtistsBox'
import { useMixes, type Mix } from '../store/mixes'
import * as I from '../ui/icons'
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
        const start = (tick * 5) % Math.max(1, pick.length - 4)
        setList(pick.slice(start, start + 5)); setBase(target)
      })
      .catch(() => alive && setList([]))
    return () => { alive = false }
  }, [cur?.id, bg, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const own = new Set(mine.map((t) => t.id))
  return (
    <div className="box">
      <h3>Похоже <button onClick={() => setTick(tick + 1)}>Ещё →</button></h3>
      <div className="minis">
        {list === null && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
        {list?.length === 0 && <div className="empty-state">Рекомендации пока недоступны</div>}
        {list?.map((t) => (
          <button key={t.id} className="mini" title={`${t.artist} — ${t.title}\n${why(t, base, own, weights)}`} onClick={() => void player.getState().playList(list, t.id, 'similar')} onContextMenu={(e) => openTrackMenu(e, [t])}>
            <Cover className="cv" url={t.coverUrl} seed={t.id} /><span className="tt">{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MixCrate({ m }: { m: Mix }) {
  const covers = m.tracks.filter((t) => t.coverUrl).slice(0, 4)
  return (
    <div className="crate" onClick={() => void player.getState().playList(m.tracks, m.tracks[0]?.id, `mix:${m.title}`)} title={`${m.tracks.length} треков`}>
      <div className="stack">
        <div /><div />
        <div className="mixcv">{covers.length === 4 ? covers.map((t) => <Cover key={t.id} url={t.coverUrl} seed={t.id} />) : <Cover url={covers[0]?.coverUrl} seed={m.key} />}<span className="mixlbl">{m.key === 'fresh' ? 'NEW' : '♥'}</span></div>
        <button className="hp" title="Играть"><I.IPlay size={16} /></button>
      </div>
      <div className="t">{m.title}</div>
      <div className="s">{m.sub}</div>
    </div>
  )
}

function ForYouRows() {
  const forYou = useLibrary((s) => s.forYou)
  const mixes = useMixes((s) => s.mixes)
  const busy = useMixes((s) => s.busy)
  useEffect(() => { void useLibrary.getState().loadForYou(); void useMixes.getState().ensure() }, [])
  const regen = () => { void useMixes.getState().generate(); void useLibrary.getState().loadForYou(true) }
  const blocks = forYou ?? []
  const first = blocks[0]
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div className="h"><h3>{first?.title ?? 'Для вас'}</h3><button className="link" disabled={busy} onClick={regen}>{busy ? 'Собираю…' : '↻ Сгенерировать заново'}</button></div>
        <div className="crates">
          {mixes.map((m) => <MixCrate key={m.key} m={m} />)}
          {first?.playlists.slice(0, 12).map((p) => <Crate key={`${p.ownerId}_${p.id}`} p={p} />)}
          {forYou === null && !mixes.length && [0, 1, 2, 3].map((i) => <div key={i} className="crate"><div className="skeleton" style={{ height: 118, width: 118 }} /></div>)}
        </div>
      </div>
      {blocks.slice(1).map((b) => (
        <div key={b.title} style={{ marginBottom: 18 }}>
          <div className="h"><h3>{b.title}</h3><span className="muted" style={{ font: '500 11px var(--M)' }}>ДЛЯ ВАС</span></div>
          <Crates list={b.playlists.slice(0, 12)} />
        </div>))}
    </>
  )
}

export function Home() {
  const playlists = useLibrary((s) => s.playlists)
  return (
    <div className="home">
      <ForYouRows />
      <div className="h"><h3>Мои плейлисты</h3><button className="link" onClick={() => useUi.getState().go('playlists')}>Все {playlists.length} →</button></div>
      {playlists.length ? <Crates list={playlists.slice(0, 12)} /> : <div className="empty-state">Плейлистов пока нет</div>}
      <div className="bento"><WaveCard /><Similar /><ArtistsBox /></div>
    </div>
  )
}
