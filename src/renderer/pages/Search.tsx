import { useEffect, useState } from 'react'
import type { Playlist, Track } from '../../shared/types'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { Crates } from '../ui/Crates'

export function Search() {
  const q = useUi((s) => s.submitted)
  const [res, setRes] = useState<{ tracks: Track[]; playlists: Playlist[] } | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!q) return
    let alive = true
    setRes(null); setErr('')
    window.api.invoke<{ tracks: Track[]; playlists: Playlist[] }>('vk:search', q)
      .then((r) => alive && setRes(r)).catch((e) => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [q])
  const artists = res ? [...new Map(res.tracks.map((t) => [t.artist.toLowerCase(), t.artist])).values()].slice(0, 8) : []
  return (
    <div className="page fill">
      <div className="ph"><h1>«{q}»</h1>{res && <span className="cnt">{res.tracks.length} треков</span>}</div>
      {err && <div className="empty-state">{err}</div>}
      {!res && !err && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}
      {res && <>
        {artists.length > 1 && <div className="artists">{artists.map((a) => <button key={a} onClick={() => useUi.getState().submit(a)}>{a}</button>)}</div>}
        {res.playlists.length > 0 && <><div className="h"><h3>Плейлисты</h3></div><Crates list={res.playlists} /><div style={{ height: 16 }} /></>}
        <div className="h"><h3>Треки</h3></div>
        {res.tracks.length ? <VirtualTrackList tracks={res.tracks} onPlay={(t) => void player.getState().playList(res.tracks, t.id, `search:${q}`)} /> : <div className="empty-state">Ничего не нашлось</div>}
      </>}
    </div>
  )
}
