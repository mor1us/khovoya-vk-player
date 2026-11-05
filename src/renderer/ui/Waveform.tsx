import { useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '../../shared/types'
import { waveBars } from './format'

/** Настоящие волны SoundCloud: грузим один раз на трек и помним. */
const realCache = new Map<string, number[]>()

function useRealBars(track: Track | undefined, n: number): number[] | null {
  const key = track ? `${track.id}:${n}` : ''
  const [bars, setBars] = useState<number[] | null>(() => (key ? realCache.get(key) ?? null : null))
  useEffect(() => {
    setBars(key ? realCache.get(key) ?? null : null)
    if (!track || track.src !== 'sc' || !track.wave || realCache.has(key)) return
    let alive = true
    window.api.invoke('sc:waveform', track, n).then((b) => {
      if (!b?.length) return
      realCache.set(key, b)
      if (alive) setBars(b)
    }).catch(() => {})
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return bars
}

/** Волна над временем: у треков SoundCloud — настоящая громкость, у остальных — рисунок по id трека. */
export function Waveform({ id, track, progress, onSeek, n = 70, className = 'wf' }: { id: string; track?: Track; progress: number; onSeek: (f: number) => void; n?: number; className?: string }) {
  const fake = useMemo(() => waveBars(id || 'none', n), [id, n])
  const real = useRealBars(track, n)
  const bars = real ?? fake
  const ref = useRef<HTMLDivElement>(null)
  const cut = Math.round(progress * n)
  return (
    <div ref={ref} className={className + (real ? ' real' : '')} onClick={(e) => {
      const r = ref.current!.getBoundingClientRect()
      onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
    }}>
      {bars.map((h, i) => <i key={i} className={i < cut ? 'p' : ''} style={{ height: `${Math.round(h * 100)}%` }} />)}
    </div>
  )
}
