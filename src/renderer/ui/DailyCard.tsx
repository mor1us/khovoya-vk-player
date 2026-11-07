import type { Playlist } from '../../shared/types'
import { useUi } from '../store/ui'
import { playPlaylist } from './Crates'
import * as I from './icons'

/** Свои плоские карточки «Плейлист дня»: номер дня, узор и подпись. Обложки ВК не используем. */
const LOOKS: { bg: string; ink: string; line?: boolean }[] = [
  { bg: '#39FF14', ink: '#0B0B0B' },
  { bg: '#141414', ink: '#39FF14', line: true },
  { bg: '#B6FF8A', ink: '#0B0B0B' },
  { bg: '#2E7D32', ink: '#F5F5F5' },
  { bg: '#0B0B0B', ink: '#39FF14', line: true }
]

function Pattern({ n, ink }: { n: number; ink: string }) {
  const p = (n - 1) % 5
  return (
    <svg className="dpat" viewBox="0 0 100 100" aria-hidden>
      {p === 0 && <><circle cx="62" cy="38" r="30" fill="none" stroke={ink} strokeWidth="10" /><circle cx="62" cy="38" r="9" fill={ink} /></>}
      {p === 1 && [0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${i * 22 - 30} 100 L${i * 22 + 40} 0`} stroke={ink} strokeWidth="7" />)}
      {p === 2 && <><path d="M20 0 H100 V80 Z" fill={ink} /><circle cx="44" cy="56" r="14" fill="none" stroke={ink} strokeWidth="6" /></>}
      {p === 3 && [0, 1, 2, 3].flatMap((x) => [0, 1, 2, 3].map((y) => <circle key={`${x}${y}`} cx={22 + x * 22} cy={12 + y * 22} r={(x + y) % 3 === 0 ? 8 : 4} fill={ink} />))}
      {p === 4 && [0, 1, 2].map((i) => <rect key={i} x={30 + i * 12} y={4 + i * 12} width={66 - i * 24} height={66 - i * 24} rx="6" fill="none" stroke={ink} strokeWidth="6" />)}
    </svg>
  )
}

export function dayNumber(p: Playlist, i: number): number {
  const m = /(\d+)/.exec(p.title)
  return m ? Math.max(1, +m[1]) : i + 1
}

export function DailyCard({ p, i }: { p: Playlist; i: number }) {
  const n = dayNumber(p, i)
  const look = LOOKS[(n - 1) % LOOKS.length]
  return (
    <div className={'bigcard daily' + (look.line ? ' line' : '')} style={{ background: look.bg, color: look.ink }} onClick={() => useUi.getState().openPlaylist(p)}>
      <Pattern n={n} ink={look.ink} />
      <div className="dk">ДЕНЬ</div>
      <div className="dn">{String(n).padStart(2, '0')}</div>
      <div className="db">
        <div className="dt">Плейлист дня</div>
        {p.subtitle ? <div className="ds">{p.subtitle}</div> : <div className="ds">{p.count} треков</div>}
      </div>
      <button className="bp" title="Играть" onClick={(e) => { e.stopPropagation(); void playPlaylist(p) }}><I.IPlay size={18} /></button>
    </div>
  )
}
