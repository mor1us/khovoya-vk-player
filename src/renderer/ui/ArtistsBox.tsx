import { useEffect } from 'react'
import { useArtists, type ArtistCard } from '../store/artists'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { Cover } from './Cover'
import { useSc } from '../store/sc'
import { feedArtists } from './feedArtists'

function ScFeedRow() {
  const me = useSc((s) => s.me)
  const feed = useSc((s) => s.feed)
  useEffect(() => { if (me && feed === null) void useSc.getState().loadFeed() }, [me, feed])
  if (!me) return null
  const list = feedArtists(feed ?? [])
  return (
    <>
      <div className="subh"><span className="srcb sc">SC</span>Подписки SoundCloud</div>
      <div className="artgrid">
        {feed === null && [0, 1, 2].map((i) => <div key={i} className="art"><div className="skeleton av" /></div>)}
        {feed !== null && !list.length && <div className="empty-state" style={{ gridColumn: '1/-1' }}>В ленте подписок пока пусто</div>}
        {list.map((a) => (
          <button key={a.name} className="art" title={`${a.name}: ${a.tracks.length} ${a.tracks.length === 1 ? 'новый трек' : 'новых'} в ленте`}
            onClick={() => void player.getState().playList(a.tracks, a.tracks[0].id, 'pl:Лента SoundCloud')}
            onContextMenu={(e) => { e.preventDefault(); useUi.getState().setSearchWhere('sc'); useUi.getState().submit(a.name) }}>
            <span className="avw"><Cover className="av" url={a.cover} seed={a.id} /><span className="badge sc"><i /><i /><i /></span></span>
            <span className="nm">{a.name}</span>
          </button>
        ))}
      </div>
    </>
  )
}

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
      <h3>Новое у твоих артистов <button onClick={() => { void useArtists.getState().load(true); if (useSc.getState().me) void useSc.getState().loadFeed() }}>Обновить</button></h3>
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
      <ScFeedRow />
    </div>
  )
}
