import { useState } from 'react'
import { hashStr } from './format'

const G = 'var(--g)', K = 'var(--k)'
/** Плоская заглушка, если у трека нет обложки: фигуры в двух цветах палитры. */
function placeholder(seed: string): React.CSSProperties {
  const h = hashStr(seed) % 6
  return [
    { background: G },
    { background: K, boxShadow: `inset 0 0 0 3px ${G}` },
    { background: `linear-gradient(${G} 0 50%, ${K} 50% 100%)` },
    { background: `linear-gradient(135deg, #1E1E1E 0 58%, ${G} 58%)` },
    { background: `linear-gradient(90deg, ${G} 0 33%, ${K} 33% 66%, ${G} 66%)` },
    { background: `radial-gradient(circle, ${G} 0 35%, ${K} 35%)` }
  ][h]
}

export function Cover({ url, seed, className, style, onClick }: { url?: string; seed: string; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  const [bad, setBad] = useState(false)
  const base: React.CSSProperties = { overflow: 'hidden', flex: 'none', ...style }
  if (!url || bad) return <div className={className} style={{ ...base, ...placeholder(seed) }} onClick={onClick} />
  return (
    <div className={className} style={{ ...base, background: '#1B1B1B' }} onClick={onClick}>
      <img src={url} alt="" loading="lazy" draggable={false} onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}
