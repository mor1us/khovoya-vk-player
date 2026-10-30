import { useEffect } from 'react'
import { useArtists, type ArtistCard } from '../store/artists'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { Cover } from './Cover'

function play(a: ArtistCard) {
  const tracks = a.tracks.filter((t) => t.available)
  if (!tracks.length) { useUi.getState().submit(a.name); return }
  void player.getState().playList(tracks, tracks[0].id, `artist:${a.name}`)
}

export function ArtistsBox() {
  const list = useArtists((s) => s.list)
  useEffect(() => { void useArtists.getState().load() }, [])
  return (
    <div className="box">
      <h3>Новое у твоих артистов <button onClick={() => void useArtists.getState().load(true)}>Обновить</button></h3>
      <div className="artgrid">
        {list === null && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="art"><div className="skeleton av" /></div>)}
        {list?.length === 0 && <div className="empty-state" style={{ gridColumn: '1/-1' }}>Добавь треки в «Моё» — здесь появятся твои артисты</div>}
        {list?.map((a) => (
          <button key={a.key} className="art" title={a.fresh ? `${a.name}: есть новые треки` : a.name} onClick={() => play(a)} onContextMenu={(e) => { e.preventDefault(); useUi.getState().submit(a.name) }}>
            <span className="avw">
              <Cover className="av" url={a.cover} seed={a.key} />
              {a.fresh && <span className="badge"><i /><i /><i /></span>}
            </span>
            <span className="nm">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
