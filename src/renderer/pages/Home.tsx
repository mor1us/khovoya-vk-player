import { useEffect } from 'react'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { Crates } from '../ui/Crates'
import { WaveCard } from '../ui/WaveCard'
import { ArtistsBox } from '../ui/ArtistsBox'
import { useMixes } from '../store/mixes'
import { BigCard } from '../ui/BigCard'
import { DailyCard } from '../ui/DailyCard'
import { dailyOnly } from '../store/dailyLogic'

function DailyRow() {
  const forYou = useLibrary((s) => s.forYou)
  const mixes = useMixes((s) => s.mixes)
  const busy = useMixes((s) => s.busy)
  useEffect(() => { void useLibrary.getState().loadForYou(); void useMixes.getState().ensure() }, [])
  const regen = () => { void useMixes.getState().generate(); void useLibrary.getState().loadForYou(true) }
  const daily = dailyOnly(forYou ?? [])
  const loading = forYou === null && !mixes.length
  return (
    <div style={{ margin: '22px 0 18px' }}>
      <div className="h"><h3>Плейлисты дня</h3><button className="link" disabled={busy} onClick={regen}>{busy ? 'Собираю…' : '↻ Сгенерировать заново'}</button></div>
      <div className="bigrow">
        {daily.map((p, i) => <DailyCard key={`${p.ownerId}_${p.id}`} p={p} i={i} />)}
        {mixes.map((m) => <BigCard key={m.key} title={m.title} sub={m.sub} seed={m.key} fill={m.key === 'fresh' ? '#39FF14' : '#1B1B1B'}
          onClick={() => void player.getState().playList(m.tracks, m.tracks[0]?.id, `mix:${m.title}`)} onPlay={() => void player.getState().playList(m.tracks, m.tracks[0]?.id, `mix:${m.title}`)} />)}
        {loading && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ flex: 'none', width: 184, height: 236, borderRadius: 18 }} />)}
      </div>
    </div>
  )
}

export function Home() {
  const playlists = useLibrary((s) => s.playlists)
  return (
    <div className="home">
      <WaveCard />
      <DailyRow />
      <div className="h"><h3>Мои плейлисты</h3><button className="link" onClick={() => useUi.getState().go('playlists')}>Все {playlists.length} →</button></div>
      {playlists.length ? <Crates list={playlists.slice(0, 12)} /> : <div className="empty-state">Плейлистов пока нет</div>}
      <div className="artrow"><ArtistsBox /></div>
    </div>
  )
}
