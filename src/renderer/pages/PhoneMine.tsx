import { useMemo } from 'react'
import { useLibrary } from '../store/library'
import { useUi, type Tab } from '../store/ui'
import { player } from '../store/playerInstance'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { plural } from '../ui/format'
import * as I from '../ui/icons'

/** Раздел списком: значок, название, стрелка. Так устроены музыкальные приложения на телефоне. */
function Section({ icon, title, to }: { icon: JSX.Element; title: string; to: Tab }) {
  return (
    <button className="psec" onClick={() => useUi.getState().go(to)}>
      <span className="ic">{icon}</span>
      <span className="t">{title}</span>
      <span className="ch">›</span>
    </button>
  )
}

/** «Моё» на телефоне: сверху разделы, ниже свои треки. */
export function PhoneMine() {
  const mine = useLibrary((s) => s.mine)
  const loaded = useLibrary((s) => s.mineLoaded)
  const list = useMemo(() => mine, [mine])

  const shuffleAll = () => {
    if (!player.getState().shuffle) player.getState().toggleShuffle()
    const avail = list.filter((t) => t.available)
    if (!avail.length) return
    void player.getState().playList(list, avail[Math.floor(Math.random() * avail.length)].id, 'mine')
  }

  return (
    <div className="page fill pmine">
      <div className="psecs">
        <Section icon={<I.IClock size={20} />} title="Недавнее" to="history" />
        <Section icon={<I.IList size={20} />} title="Плейлисты" to="playlists" />
        <Section icon={<I.IQueue size={20} />} title="Очередь" to="queue" />
        <Section icon={<I.IHeartOff size={20} />} title="Не нравится" to="disliked" />
      </div>

      <div className="pmh">
        <h2>Мои треки</h2>
        <span className="cnt">{mine.length}</span>
      </div>

      <button className="pshuffle" onClick={shuffleAll} disabled={!list.length}>
        <span className="ic"><I.IShuffle size={18} /></span>
        Перемешать все
      </button>

      {!loaded ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)
        : list.length ? <VirtualTrackList tracks={list} onPlay={(t) => void player.getState().playList(list, t.id, 'mine')} />
        : <div className="empty-state">Здесь появятся треки, которые ты добавишь. {plural(0, '', '', '')}</div>}
    </div>
  )
}
