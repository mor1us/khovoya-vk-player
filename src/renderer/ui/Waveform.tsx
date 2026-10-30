import { useMemo, useRef } from 'react'
import { waveBars } from './format'

export function Waveform({ id, progress, onSeek, n = 70, className = 'wf' }: { id: string; progress: number; onSeek: (f: number) => void; n?: number; className?: string }) {
  const bars = useMemo(() => waveBars(id || 'none', n), [id, n])
  const ref = useRef<HTMLDivElement>(null)
  const cut = Math.round(progress * n)
  return (
    <div ref={ref} className={className} onClick={(e) => {
      const r = ref.current!.getBoundingClientRect()
      onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
    }}>
      {bars.map((h, i) => <i key={i} className={i < cut ? 'p' : ''} style={{ height: `${Math.round(h * 100)}%` }} />)}
    </div>
  )
}
