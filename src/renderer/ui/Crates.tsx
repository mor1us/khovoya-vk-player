import { useState } from 'react'
import type { Playlist, Track } from '../../shared/types'
import { Cover } from './Cover'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { player } from '../store/playerInstance'
import { addToPlaylist, loadPlaylistTracks } from '../store/playlists'
import { plural } from './format'
import * as I from './icons'
import { rememberPlaylist } from '../store/sourceNav'

export async function playPlaylist(p: Playlist, shuffle = false) {
  try {
    const tracks = await loadPlaylistTracks(p)
    if (!tracks.length) { useUi.getState().toast('Плейлист пустой'); return }
    if (shuffle !== player.getState().shuffle) player.getState().toggleShuffle()
    const first = shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks.find((t) => t.available)
    rememberPlaylist(p)
    await player.getState().playList(tracks, first?.id, `pl:${p.title}`)
  } catch (e) { useUi.getState().toast((e as Error).message) }
}

export function Crate({ p }: { p: Playlist }) {
  const [drop, setDrop] = useState(false)
  const covers = p.coverUrls.length ? p.coverUrls : []
  return (
    <div className={'crate' + (drop ? ' drop' : '')} onClick={() => useUi.getState().openPlaylist(p)}
      onDragOver={(e) => { if (p.isMine && e.dataTransfer.types.includes('text/track-ids')) { e.preventDefault(); setDrop(true) } }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        setDrop(false)
        const ids = JSON.parse(e.dataTransfer.getData('text/track-ids') || '[]') as string[]
        const lib = useLibrary.getState().mine, q = player.getState().queue?.list() ?? []
        const pool = new Map<string, Track>([...q, ...lib].map((t) => [t.id, t]))
        const tracks = ids.map((id) => pool.get(id)).filter(Boolean) as Track[]
        if (tracks.length) void addToPlaylist(p, tracks)
      }}>
      <div className="stack">
        <div /><div />
        <Cover url={covers[0]} seed={'pl' + p.id} style={{ position: 'absolute', inset: 0, borderRadius: 14 }} />
        <button className="hp" title="Играть" onClick={(e) => { e.stopPropagation(); void playPlaylist(p) }}><I.IPlay size={16} /></button>
      </div>
      <div className="t">{p.title}</div>
      <div className="s">{p.count} {plural(p.count, 'трек', 'трека', 'треков')}</div>
    </div>
  )
}

export function Crates({ list, lead }: { list: Playlist[]; lead?: React.ReactNode }) {
  return <div className="crates">{lead}{list.map((p) => <Crate key={`${p.ownerId}_${p.id}`} p={p} />)}</div>
}
