import { useEffect } from 'react'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { Crates } from '../ui/Crates'
import { WaveCard } from '../ui/WaveCard'
import { ArtistsBox } from '../ui/ArtistsBox'
import { useMixes, type Mix } from '../store/mixes'
import { Cover } from '../ui/Cover'
import * as I from '../ui/icons'
import { BigCard } from '../ui/BigCard'
import { DailyCard } from '../ui/DailyCard'
import { dailyOnly } from '../store/dailyLogic'
import { useHScroll, Arrows } from '../ui/HScroll'

/** «Забытое любимое» и др. миксы — отдельной карточкой-стопкой из 4 обложек. */
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

function DailyRow() {
  const forYou = useLibrary((s) => s.forYou)
  const mixes = useMixes((s) => s.mixes)
  const busy = useMixes((s) => s.busy)
  useEffect(() => { void useLibrary.getState().loadForYou(); void useMixes.getState().ensure() }, [])
  const regen = () => { void useMixes.getState().generate(); void useLibrary.getState().loadForYou(true) }
  const daily = dailyOnly(forYou ?? [])
  const loading = forYou === null && !mixes.length
  const row = useHScroll()
  return (
    <div style={{ margin: '22px 0 18px' }}>
      <div className="h"><h3>Плейлисты дня</h3><span className="hr"><button className="link" disabled={busy} onClick={regen}>{busy ? 'Собираю…' : '↻ Сгенерировать заново'}</button><Arrows s={row} /></span></div>
      <div className="bigrow" ref={row.ref}>
        {daily.map((p, i) => <DailyCard key={`${p.ownerId}_${p.id}`} p={p} i={i} />)}
        {mixes.filter((m) => m.key !== 'fav').map((m) => <BigCard key={m.key} title={m.title} sub={m.sub} seed={m.key} fill={m.key === 'fresh' ? '#39FF14' : '#1B1B1B'}
          onClick={() => void player.getState().playList(m.tracks, m.tracks[0]?.id, `mix:${m.title}`)} onPlay={() => void player.getState().playList(m.tracks, m.tracks[0]?.id, `mix:${m.title}`)} />)}
        {loading && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ flex: 'none', width: 184, height: 236, borderRadius: 18 }} />)}
      </div>
    </div>
  )
}

export function Home() {
  const playlists = useLibrary((s) => s.playlists)
  const fav = useMixes((s) => s.mixes.find((m) => m.key === 'fav'))
  const row = useHScroll()
  const lead = fav ? <><MixCrate m={fav} /><div className="crsep" aria-hidden /></> : null
  return (
    <div className="home">
      <WaveCard />
      <DailyRow />
      <div className="h"><h3>Мои плейлисты</h3><span className="hr"><button className="link" onClick={() => useUi.getState().go('playlists')}>Все {playlists.length} →</button><Arrows s={row} /></span></div>
      {playlists.length || fav ? <Crates list={playlists.slice(0, 12)} lead={lead} rowRef={row.ref} /> : <div className="empty-state">Плейлистов пока нет</div>}
      <div className="artrow"><ArtistsBox /></div>
    </div>
  )
}
