import { useState } from 'react'
import type { Playlist } from '../../shared/types'
import { useUi } from '../store/ui'
import { playPlaylist } from './Crates'
import { hashStr } from './format'
import * as I from './icons'

/** Плоские цвета для карточек без обложки (своя палитра, без градиентов). */
const FILLS = ['#39FF14', '#1B1B1B', '#2E7D32', '#0B0B0B', '#B6FF8A', '#145A1E']
const dark = (c: string) => ['#39FF14', '#B6FF8A'].includes(c)

export function BigCard({ title, sub, cover, seed, onClick, onPlay, fill }: { title: string; sub?: string; cover?: string; seed: string; onClick: () => void; onPlay: () => void; fill?: string }) {
  const [bad, setBad] = useState(false)
  const bg = fill ?? FILLS[hashStr(seed) % FILLS.length]
  const img = cover && !bad
  const ink = img ? '#F5F5F5' : dark(bg) ? '#0B0B0B' : '#F5F5F5'
  return (
    <div className="bigcard" style={{ background: bg, color: ink }} onClick={onClick}>
      {img && <><img src={cover} alt="" loading="lazy" onError={() => setBad(true)} /><div className="veil" /></>}
      <div className="txt"><div className="bt">{title}</div>{sub && <div className="bs">{sub}</div>}</div>
      <button className="bp" title="Играть" onClick={(e) => { e.stopPropagation(); onPlay() }}><I.IPlay size={18} /></button>
    </div>
  )
}

export function PlaylistBigCard({ p }: { p: Playlist }) {
  return <BigCard title={p.title} sub={p.subtitle} cover={p.coverUrls[0]} seed={'pl' + p.id} onClick={() => useUi.getState().openPlaylist(p)} onPlay={() => void playPlaylist(p)} />
}
