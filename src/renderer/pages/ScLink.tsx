import { useEffect, useState } from 'react'
import type { Track } from '../../shared/types'
import { player } from '../store/playerInstance'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { TrackRow, SrcBadge } from '../ui/TrackRow'
import { Cover } from '../ui/Cover'
import { PlaylistActions } from '../ui/PlaylistActions'
import { plural } from '../ui/format'
import * as I from '../ui/icons'

type Resolved =
  | { kind: 'track'; track: Track }
  | { kind: 'playlist'; title: string; author: string; cover?: string; link?: string; tracks: Track[] }

export const isScUrl = (s: string) => /^https?:\/\/(?:www\.|m\.|on\.)?soundcloud\.com\/\S+/i.test(s.trim())

/** Вставил в поиск ссылку SoundCloud — показываем трек или плейлист: слушать, сохранить, перенести в ВК. */
export function ScLink({ url }: { url: string }) {
  const [r, setR] = useState<Resolved | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let alive = true
    setR(null); setErr('')
    window.api.invoke<Resolved>('sc:resolve', url).then((x) => alive && setR(x)).catch((e) => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [url])
  const src = r?.kind === 'playlist' ? `pl:${r.title}` : 'search:ссылка SoundCloud'
  const play = (ts: Track[], id: string, shuffle = false) => {
    if (shuffle !== player.getState().shuffle) player.getState().toggleShuffle()
    void player.getState().playList(ts, id, src)
  }
  return (
    <div className="page fill">
      <div className="ph"><h1><SrcBadge src="sc" />Ссылка SoundCloud</h1></div>
      {err && <div className="scdown"><SrcBadge src="sc" />{err}</div>}
      {!r && !err && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}
      {r?.kind === 'track' && <div className="rows"><TrackRow track={r.track} index={0} showSrc onPlay={() => play([r.track], r.track.id)} /></div>}
      {r?.kind === 'playlist' && <>
        <div className="sclhead">
          <Cover className="cv" url={r.cover} seed={'scl' + r.title} />
          <div style={{ minWidth: 0 }}>
            <div className="k">ПЛЕЙЛИСТ SOUNDCLOUD{r.author ? ` · ${r.author}` : ''}</div>
            <h2>{r.title}</h2>
            <div className="muted">{r.tracks.length} {plural(r.tracks.length, 'трек', 'трека', 'треков')}</div>
            <div className="acts">
              <button className="btn-s sco" disabled={!r.tracks.length} onClick={() => play(r.tracks, r.tracks[0].id)}><I.IPlay size={14} />Слушать</button>
              <button className="btn-s" disabled={!r.tracks.length} onClick={() => play(r.tracks, r.tracks[Math.floor(Math.random() * r.tracks.length)].id, true)}><I.IShuffle size={14} />Перемешать</button>
              <PlaylistActions title={r.title} tracks={r.tracks} />
            </div>
          </div>
        </div>
        <VirtualTrackList tracks={r.tracks} showSrc onPlay={(t) => play(r.tracks, t.id)} />
      </>}
    </div>
  )
}
